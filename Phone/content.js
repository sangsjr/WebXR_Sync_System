// Build A-Frame Page
(function() {
    'use strict';
    
    let isInitialized = false;
    let poseInterval = null;
    let camera = null;
    
    // Check if overlay parameter exists to avoid recursion
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('overlay')) {
        console.log('Detected overlay parameter, skipping injection');
        return;
    }
    
    if (isInitialized) return;
    isInitialized = true;
    
    console.log('WebXR Sync System Content Script: Starting WebXR AR initialization...');
    
    // Save the original page URL and add overlay tags
    const originalURL = window.location.href + (window.location.href.includes('?') ? '&' : '?') + 'overlay=1';
    
    function initializeAFrame() {
        console.log('Initializing A-Frame page');
        
        const head = document.head || document.getElementsByTagName('head')[0];
        head.innerHTML = '';
        
        const charset = document.createElement('meta');
        charset.setAttribute('charset', 'utf-8');
        head.appendChild(charset);
        
        const viewport = document.createElement('meta');
        viewport.setAttribute('name', 'viewport');
        viewport.setAttribute('content', 'width=device-width, initial-scale=1');
        head.appendChild(viewport);
        
        const title = document.createElement('title');
        title.textContent = 'WebXR Sync System - Phone';
        head.appendChild(title);
        
        const aframeScript = document.createElement('script');
        aframeScript.src = 'https://aframe.io/releases/1.7.0/aframe.min.js';
        head.appendChild(aframeScript);
        
        const style = document.createElement('style');
        style.textContent = `
            body, html {
                margin: 0;
                padding: 0;
                width: 100%;
                height: 100%;
                overflow: hidden;
            }
            #dom-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 1000;
                pointer-events: auto;
            }
            #dom-overlay iframe {
                width: 100%;
                height: 100%;
                border: none;
            }
            #overlay-message {
                position: absolute;
                top: 20px;
                right: 20px;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 14px;
                z-index: 1001;
                max-width: 300px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            }
            #overlay-message .close-btn {
                position: absolute;
                top: 5px;
                right: 8px;
                background: none;
                border: none;
                color: white;
                font-size: 18px;
                cursor: pointer;
                padding: 0;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            #overlay-message .close-btn:hover {
                background: rgba(255, 255, 255, 0.2);
                border-radius: 50%;
            }
            a-scene {
                width: 100%;
                height: 100%;
            }
        `;
        head.appendChild(style);
        
        document.body.innerHTML = '';
        
        const domOverlay = document.createElement('div');
        domOverlay.id = 'dom-overlay';
        
        const messageBox = document.createElement('div');
        messageBox.id = 'overlay-message';
        messageBox.innerHTML = `
            <button class="close-btn" onclick="this.parentElement.style.display='none'">&times;</button>
            <strong>WebXR AR</strong><br>
            This page is a Dom-Overlay Page<br>
            <small>Click × in the upper right corner to close this message.</small>
        `;
        domOverlay.appendChild(messageBox);
        
        const iframe = document.createElement('iframe');
        iframe.src = originalURL;
        iframe.setAttribute('allowfullscreen', '');
        domOverlay.appendChild(iframe);
        
        document.body.appendChild(domOverlay);
        
        console.log('WebXR Sync System: A-Frame page structure created');
        
        aframeScript.onload = function() {
            createAFrameScene();
        };
        
        if (typeof AFRAME !== 'undefined') {
            createAFrameScene();
        }
    }
    
    function createAFrameScene() {
        const scene = document.createElement('a-scene');
        scene.setAttribute('embedded', '');
        scene.setAttribute('xr-mode-ui', 'enabled: true; XRMode: ar');
        scene.setAttribute('webxr', 'requiredFeatures: hit-test,local-floor; overlayElement: #dom-overlay;');
        scene.setAttribute('device-orientation-permission-ui', 'enabled: false');
        
        const rig = document.createElement('a-entity');
        rig.id = 'rig';
        rig.setAttribute('position', '0 0 0');
        
        const camera = document.createElement('a-camera');
        camera.id = 'camera';
        rig.appendChild(camera);
        
        scene.appendChild(rig);
        
        const ambientLight = document.createElement('a-entity');
        ambientLight.setAttribute('light', 'type: ambient; color: #BBB');
        scene.appendChild(ambientLight);
        
        const directionalLight = document.createElement('a-entity');
        directionalLight.setAttribute('light', 'type: directional; color: #FFF; intensity: 0.6');
        directionalLight.setAttribute('position', '-0.5 1 1');
        scene.appendChild(directionalLight);
        
        const grid = document.createElement('a-grid');
        grid.setAttribute('position', '0 0 0');
        grid.setAttribute('rotation', '-90 0 0');
        grid.setAttribute('width', '10');
        grid.setAttribute('height', '10');
        grid.setAttribute('color', '#666');
        scene.appendChild(grid);
        
        document.body.appendChild(scene);
        
        waitForAFrame();
    }
    
    function waitForAFrame() {
        if (typeof AFRAME !== 'undefined' && document.querySelector('a-scene')) {
            const scene = document.querySelector('a-scene');
            
            if (scene.hasLoaded) {
                initializeTracking();
            } else {
                scene.addEventListener('loaded', initializeTracking);
            }
        } else {
            setTimeout(waitForAFrame, 100);
        }
    }
    
    function initializeTracking() {
        console.log('Initializing tracking system...');
        
        camera = document.querySelector('#camera');
        
        if (!camera) {
            console.error('Camera element not found');
            return;
        }
        
        startPoseTracking();
        
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.type === 'request-calibration') {
                console.log('Received calibration request');
                handleCalibrationRequest();
                sendResponse({success: true});
            } else if (request.type === 'disable-tracking') {
                console.log('Disabling tracking...');
                handleDisableTracking();
                sendResponse({success: true});
            }
        });
        
        console.log('Tracking system initialized successfully');
    }
    
    function startPoseTracking() {
        if (poseInterval) {
            clearInterval(poseInterval);
        }
        
        poseInterval = setInterval(() => {
            if (camera && camera.object3D) {
                const position = camera.object3D.position;
                const rotation = new THREE.Euler().setFromQuaternion(camera.object3D.quaternion);
                
                const poseData = {
                    position: {
                        x: position.x,
                        y: position.y,
                        z: position.z
                    },
                    rotation: {
                        x: rotation.x,
                        y: rotation.y,
                        z: rotation.z
                    },
                    timestamp: performance.now()
                };
                
                chrome.runtime.sendMessage({
                    type: 'pose-data',
                    data: poseData
                }).catch(error => {
                    if (!error.message.includes('Extension context invalidated')) {
                        console.warn('Failed to send pose data:', error);
                    }
                });
            }
        }, 33);
    }
    
    function handleCalibrationRequest() {
        if (camera && camera.object3D) {
            const position = camera.object3D.position;
            const rotation = new THREE.Euler().setFromQuaternion(camera.object3D.quaternion);
            
            const calibrationData = {
                position: {
                    x: position.x,
                    y: position.y,
                    z: position.z
                },
                rotation: {
                    x: rotation.x,
                    y: rotation.y,
                    z: rotation.z
                },
                timestamp: performance.now()
            };
            
            chrome.runtime.sendMessage({
                type: 'calibration-data',
                data: calibrationData
            }).then(() => {
                console.log('Calibration data sent successfully');
            }).catch(error => {
                console.error('Failed to send calibration data:', error);
            });
        } else {
            console.error('Camera not available for calibration');
        }
    }
    
    function handleDisableTracking() {
        if (poseInterval) {
            clearInterval(poseInterval);
            poseInterval = null;
        }
        
        try {
            window.location.reload();
        } catch (error) {
            console.warn('Failed to reload page:', error);
        }
    }
    
    window.addEventListener('beforeunload', () => {
        if (poseInterval) {
            clearInterval(poseInterval);
        }
    });
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeAFrame);
    } else {
        initializeAFrame();
    }
})();