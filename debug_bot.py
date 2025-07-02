# -*- coding: utf-8 -*-
# type: ignore
"""
Debug Bot - Comprehensive automation script with self-healing capabilities
Note: This file uses dynamic typing for automation flexibility.
All type checking warnings are intentionally suppressed.
"""
import os
import sys

# Fix Windows Unicode encoding issues
if sys.platform.startswith('win'):
    os.environ['PYTHONIOENCODING'] = 'utf-8'
    import codecs
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')  # type: ignore
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')  # type: ignore

import asyncio
import random
import json
from datetime import datetime, timedelta
from playwright.async_api import async_playwright  # type: ignore
import logging

print('Script gestartet')

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ThundrBot:
    def __init__(self, proxies=None, messages=None):
        self.proxies = proxies or []
        self.current_proxy_index = 0
        self.messages = messages or ["Write me on Snapchat for Free nude ;* Snapchat : LaLiLuLaara"]
        self.browser = None
        self.context = None
        self.page = None
        
        self.session_birth_date = None
        self.session_interests = None
        self.session_initialized = False
        
        self.interests_cache_file = "thundr_interests_cache.json"
        self.all_available_interests = []
        self.interests_preloaded = False

    def save_interests_cache(self, interests):
        try:
            with open(self.interests_cache_file, 'w', encoding='utf-8') as f:
                json.dump(interests, f, ensure_ascii=False, indent=2)
            print(f"[OK] {len(interests)} Interests im Cache gespeichert")
        except Exception as e:
            print(f"[WARNING] Fehler beim Speichern des Interest-Cache: {e}")

    def load_interests_cache(self):
        try:
            if os.path.exists(self.interests_cache_file):
                with open(self.interests_cache_file, 'r', encoding='utf-8') as f:
                    interests = json.load(f)
                print(f"[OK] {len(interests)} Interests aus Cache geladen")
                return interests
        except Exception as e:
            print(f"[WARNING] Fehler beim Laden des Interest-Cache: {e}")
        return []

    def init_session_data(self):
        if not self.session_initialized:
            today = datetime.now()
            start_date = today - timedelta(days=25*365)
            end_date = today - timedelta(days=18*365)
            random_date = start_date + timedelta(
                days=random.randint(0, (end_date - start_date).days)
            )
            self.session_birth_date = {
                'day': random_date.strftime('%d'),
                'month': random_date.strftime('%m'),
                'year': random_date.strftime('%Y')
            }
            
            self.all_available_interests = self.load_interests_cache()
            
            if self.all_available_interests and len(self.all_available_interests) >= 33:
                self.session_interests = random.sample(self.all_available_interests, 33)
                print(f"[OK] Selected 33 interests from {len(self.all_available_interests)} available")
            elif self.all_available_interests:
                # Repeat available interests to reach 33
                repeat_count = (33 // len(self.all_available_interests)) + 1
                self.session_interests = (self.all_available_interests * repeat_count)[:33]
                print(f"[REPEAT] Repeated {len(self.all_available_interests)} interests {repeat_count} times to reach 33")
            else:
                fallback_interests = ["Gaming", "Music", "Movies", "Sports", "Technology", "Art", "Travel", "Food", "Photography", "Dancing"]
                self.session_interests = (fallback_interests * 4)[:33]  # 10 * 4 = 40, take first 33
                print(f"[FALLBACK] Using emergency fallback interests, repeated to reach 33")
            
            self.session_initialized = True
            print(f"[TARGET] Session-Daten initialisiert:")
            print(f"   Geburtsdatum: {self.session_birth_date['day']}.{self.session_birth_date['month']}.{self.session_birth_date['year']}")
            print(f"   Interessen ({len(self.session_interests)}): {', '.join(self.session_interests[:5])}")

    def get_next_proxy(self):
        if not self.proxies:
            return None
        proxy = self.proxies[self.current_proxy_index]
        self.current_proxy_index = (self.current_proxy_index + 1) % len(self.proxies)
        return proxy

    async def setup_browser(self, proxy=None):
        # PRIORITY: Force ManyCam detection at OS level
        try:
            print("🚨 NUCLEAR: Forcing ManyCam detection...")
            
            # Check if ManyCam is running
            import subprocess
            import os
            
            # Try to start ManyCam if not running
            manycam_paths = [
                r"C:\Program Files\ManyCam\ManyCam.exe",
                r"C:\Program Files (x86)\ManyCam\ManyCam.exe",
                r"C:\Users\{}\AppData\Local\ManyCam\ManyCam.exe".format(os.getenv('USERNAME')),
            ]
            
            manycam_running = False
            for path in manycam_paths:
                if os.path.exists(path):
                    try:
                        # ULTRATHINK: Launch ManyCAm normally (it auto-registers virtual camera)
                        subprocess.Popen([path], shell=True)
                        print(f"✅ ManyCam started: {path}")
                        manycam_running = True
                        await asyncio.sleep(5)  # Wait for ManyCAm to fully load and register
                        break
                    except Exception as e:
                        print(f"❌ Failed to start ManyCam from {path}: {e}")
            
            if not manycam_running:
                print("⚠️ ManyCam not found or couldn't start - using synthetic camera")
            
            # Force Windows camera registry check
            try:
                result = subprocess.run(['reg', 'query', r'HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\DeviceClasses\{65e8773d-8f56-11d0-a3b9-00a0c9223196}'], 
                                      capture_output=True, text=True, shell=True)
                if 'manycam' in result.stdout.lower():
                    print("✅ ManyCam detected in Windows registry")
                else:
                    print("⚠️ ManyCam not found in registry - using override")
            except Exception as e:
                print(f"⚠️ Registry check failed: {e}")
                
        except Exception as e:
            print(f"⚠️ ManyCam detection failed: {e}")
        
        # ULTRATHINK: Set environment variables for better camera support
        os.environ['CHROME_DEVEL_SANDBOX'] = '0'
        os.environ['DISPLAY'] = ':0'  # For Linux compatibility
        
        playwright = await async_playwright().start()
        browser_args = {
            'headless': False,
            'args': [
                '--no-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--allow-running-insecure-content',
                
                # CRITICAL MANYCAM FIXES - Hardware acceleration bypass
                '--disable-gpu',
                '--disable-gpu-compositing',
                '--disable-gpu-rasterization', 
                '--disable-gpu-sandbox',
                '--disable-software-rasterizer',
                
                # VIRTUAL CAMERA SUPPORT
                '--enable-usermedia-screen-capturing',
                '--enable-experimental-web-platform-features',
                '--autoplay-policy=no-user-gesture-required',
                '--use-fake-ui-for-media-stream',
                '--enable-media-stream',
                '--disable-permissions-api',
                
                # WEBRTC ENHANCEMENTS
                '--enable-webrtc-hw-decoding',
                '--enable-webrtc-hw-encoding',
                '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
                
                # STABILITY IMPROVEMENTS
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--force-device-scale-factor=1',
                '--disable-ipc-flooding-protection',
                '--allow-elevated-browser',
                '--disable-site-isolation-trials',
                '--disable-features=TranslateUI,BlinkGenPropertyTrees',
                '--disable-dev-shm-usage'
            ]
        }
        if proxy:
            browser_args['proxy'] = {
                'server': f"http://{proxy['host']}:{proxy['port']}",
                'username': proxy.get('username'),
                'password': proxy.get('password')
            }
            logger.info(f"Using proxy: {proxy['host']}:{proxy['port']}")
        self.browser = await playwright.chromium.launch(**browser_args)
        context_args = {
            'viewport': {'width': 1280, 'height': 720},
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'permissions': ['camera', 'microphone']
        }
        self.context = await self.browser.new_context(**context_args)
        self.page = await self.context.new_page()

        # --- ULTRATHINK: Unique identifier for bot window ---
        await self.page.goto('about:blank?bot=ManyCAmTest')
        await self.page.evaluate("document.title = 'BOT WINDOW - ManyCAm Test'")
        # ---------------------------------------------------
        
        await self.context.grant_permissions(['camera', 'microphone'], origin='https://thundr.com')
        
        await self.page.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
            
            // NUCLEAR PRELOAD: Create ManyCam stream IMMEDIATELY
            let globalManyCamStream = null;
            
            (async () => {
                try {
                    console.log('🚀 PRELOAD: Creating ManyCam stream immediately...');
                    
                    // Force create canvas stream immediately
                    const canvas = document.createElement('canvas');
                    canvas.width = 1280;
                    canvas.height = 720;
                    const ctx = canvas.getContext('2d');
                    
                    let frame = 0;
                    const animate = () => {
                        // Create animated ManyCam-style content
                        const gradient = ctx.createLinearGradient(0, 0, 1280, 720);
                        gradient.addColorStop(0, '#FF6B6B');
                        gradient.addColorStop(0.5, '#4ECDC4');
                        gradient.addColorStop(1, '#45B7D1');
                        ctx.fillStyle = gradient;
                        ctx.fillRect(0, 0, 1280, 720);
                        
                        // Animated elements
                        const time = Date.now() * 0.001;
                        const pulse = Math.sin(time * 2) * 0.5 + 0.5;
                        
                        // Main text
                        ctx.fillStyle = '#FFFFFF';
                        ctx.font = 'bold 72px Arial';
                        ctx.textAlign = 'center';
                        ctx.shadowColor = '#000000';
                        ctx.shadowBlur = 15;
                        ctx.fillText('ManyCam Virtual Camera', 640, 280);
                        
                        // Subtitle
                        ctx.font = 'bold 36px Arial';
                        ctx.fillStyle = `rgba(255, 255, 255, ${0.8 + pulse * 0.2})`;
                        ctx.fillText('ULTRATHINK Override Active', 640, 340);
                        
                        // Status indicators
                        ctx.font = 'bold 24px Arial';
                        ctx.fillStyle = '#00FF00';
                        ctx.fillText(`🟢 LIVE - Frame ${frame}`, 640, 420);
                        ctx.fillText(`⚡ Ready for Thundr.com`, 640, 460);
                        
                        // Moving dots
                        for (let i = 0; i < 5; i++) {
                            const x = 200 + i * 200 + Math.sin(time + i) * 50;
                            const y = 600 + Math.cos(time * 1.5 + i) * 30;
                            ctx.fillStyle = '#FFFF00';
                            ctx.beginPath();
                            ctx.arc(x, y, 10 + pulse * 5, 0, Math.PI * 2);
                            ctx.fill();
                        }
                        
                        frame++;
                        requestAnimationFrame(animate);
                    };
                    animate();
                    
                    globalManyCamStream = canvas.captureStream(30);
                    
                    // Mark as ManyCam
                    Object.defineProperty(globalManyCamStream, '_isManyCam', {
                        value: true,
                        writable: false
                    });
                    
                    console.log('✅ PRELOAD: ManyCam stream created and ready!');
                    
                } catch (error) {
                    console.log('❌ PRELOAD: Failed to create ManyCam stream:', error);
                }
            })();
            
            // Enhanced camera device spoofing with ManyCam support
            Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', {
                value: async () => [
                    { 
                        kind: 'videoinput', 
                        label: 'ManyCam Virtual Webcam', 
                        deviceId: 'manycam-device-001',
                        groupId: 'group1'
                    },
                    { 
                        kind: 'videoinput', 
                        label: 'HD Pro Webcam C920', 
                        deviceId: 'a1b2c3d4e5f6g7h8i9j0',
                        groupId: 'group1'
                    },
                    { 
                        kind: 'audioinput', 
                        label: 'Microphone (HD Pro Webcam C920)', 
                        deviceId: 'k1l2m3n4o5p6q7r8s9t0',
                        groupId: 'group1'
                    }
                ]
            });
            
            // ULTRATHINK: Complete ManyCam Override System
            console.log('🚀 ULTRATHINK: Initializing ManyCam override system...');
            
            // Step 1: Force ManyCam device to exist
            Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', {
                value: () => {
                    console.log('🎥 FORCED: ManyCam device injection');
                    return Promise.resolve([
                        {
                            kind: 'videoinput',
                            label: 'ManyCam Virtual Webcam',
                            deviceId: 'manycam-ultrathink-001',
                            groupId: 'manycam-group'
                        },
                        {
                            kind: 'videoinput', 
                            label: 'HD Pro Webcam C920',
                            deviceId: 'backup-camera-001',
                            groupId: 'backup-group'
                        },
                        {
                            kind: 'audioinput',
                            label: 'Microphone Array',
                            deviceId: 'audio-001',
                            groupId: 'audio-group'
                        }
                    ]);
                }
            });
            
            // Step 2: NUCLEAR ManyCam Override - Replace ALL streams
            const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
            let manyCamStreamCache = null;
            
            // Create ManyCam stream immediately
            const createManyCamStream = async () => {
                console.log('🎨 CREATING: Nuclear ManyCam stream...');
                
                // Try multiple approaches
                const approaches = [
                    // Approach 1: Force real ManyCam with exact device selection
                    async () => {
                        try {
                            console.log('🔄 Approach 1: Real ManyCam with forced deviceId');
                            const devices = await navigator.mediaDevices.enumerateDevices();
                            console.log('📱 Available devices:', devices.map(d => d.label));
                            
                            // Try to find any ManyCam-like device
                            const manyCamDevice = devices.find(d => 
                                d.kind === 'videoinput' && 
                                (d.label.toLowerCase().includes('manycam') ||
                                 d.label.toLowerCase().includes('virtual') ||
                                 d.label.toLowerCase().includes('obs'))
                            );
                            
                            if (manyCamDevice) {
                                console.log('🎯 Found ManyCam device:', manyCamDevice.label);
                                return await originalGetUserMedia({
                                    video: { deviceId: { exact: manyCamDevice.deviceId } },
                                    audio: false
                                });
                            }
                            throw new Error('No ManyCam device found');
                        } catch (e) {
                            console.log('❌ Approach 1 failed:', e.message);
                            throw e;
                        }
                    },
                    
                    // Approach 2: Screen capture (works everywhere)
                    async () => {
                        console.log('🔄 Approach 2: Screen capture as camera');
                        if (navigator.mediaDevices.getDisplayMedia) {
                            const stream = await navigator.mediaDevices.getDisplayMedia({
                                video: { width: 1280, height: 720 }
                            });
                            console.log('📺 Screen capture stream created');
                            return stream;
                        }
                        throw new Error('getDisplayMedia not available');
                    },
                    
                    // Approach 3: Synthetic video (always works)
                    async () => {
                        console.log('🔄 Approach 3: Synthetic ManyCam video');
                        const canvas = document.createElement('canvas');
                        canvas.width = 1280;
                        canvas.height = 720;
                        const ctx = canvas.getContext('2d');
                        
                        let frame = 0;
                        const animate = () => {
                            // Animated ManyCam-style background
                            const gradient = ctx.createLinearGradient(0, 0, 1280, 720);
                            gradient.addColorStop(0, '#1e3c72');
                            gradient.addColorStop(1, '#2a5298');
                            ctx.fillStyle = gradient;
                            ctx.fillRect(0, 0, 1280, 720);
                            
                            // Pulsing effect
                            const pulse = Math.sin(frame * 0.1) * 30 + 50;
                            ctx.fillStyle = `rgba(255, 255, 255, ${pulse / 100})`;
                            ctx.fillRect(0, 0, 1280, 720);
                            
                            // ManyCam branding
                            ctx.fillStyle = '#FFFFFF';
                            ctx.font = 'bold 60px Arial';
                            ctx.textAlign = 'center';
                            ctx.shadowColor = '#000000';
                            ctx.shadowBlur = 10;
                            ctx.fillText('ManyCam Virtual Camera', 640, 320);
                            
                            ctx.font = 'bold 36px Arial';
                            ctx.fillText('ULTRATHINK Override Active', 640, 380);
                            
                            ctx.font = 'bold 24px Arial';
                            ctx.fillText(`Frame: ${frame}`, 640, 450);
                            
                            frame++;
                            setTimeout(animate, 33); // ~30 FPS
                        };
                        animate();
                        
                        const stream = canvas.captureStream(30);
                        console.log('🎨 Synthetic ManyCam stream created');
                        return stream;
                    }
                ];
                
                // Try approaches in order
                for (let i = 0; i < approaches.length; i++) {
                    try {
                        const stream = await approaches[i]();
                        console.log(`✅ NUCLEAR: Approach ${i + 1} succeeded!`);
                        
                        // Mark as ManyCam stream
                        Object.defineProperty(stream, '_manyCamOverride', {
                            value: true,
                            writable: false
                        });
                        
                        return stream;
                    } catch (error) {
                        console.log(`❌ Approach ${i + 1} failed:`, error.message);
                        if (i === approaches.length - 1) {
                            throw new Error('All ManyCam approaches failed');
                        }
                    }
                }
            };
            
            navigator.mediaDevices.getUserMedia = async (constraints) => {
                console.log('🚨 NUCLEAR: getUserMedia intercepted');
                console.log('📋 Original constraints:', JSON.stringify(constraints));
                
                try {
                    // PRIORITY 1: Use preloaded global stream if available
                    if (globalManyCamStream && globalManyCamStream._isManyCam) {
                        console.log('⚡ INSTANT: Using preloaded ManyCam stream!');
                        const clonedStream = globalManyCamStream.clone();
                        
                        Object.defineProperty(clonedStream, '__thundr_real_stream', { 
                            value: true, 
                            writable: false 
                        });
                        
                        Object.defineProperty(clonedStream, '_manyCamForced', {
                            value: true,
                            writable: false
                        });
                        
                        console.log('🎉 INSTANT: Preloaded ManyCam stream delivered!');
                        return clonedStream;
                    }
                    
                    // PRIORITY 2: Fallback to dynamic creation
                    if (!manyCamStreamCache) {
                        console.log('🔥 Creating new ManyCam stream...');
                        manyCamStreamCache = await createManyCamStream();
                    } else {
                        console.log('♻️ Reusing cached ManyCam stream');
                    }
                    
                    // Clone the stream for each request
                    const clonedStream = manyCamStreamCache.clone();
                    
                    // Mark stream properties
                    Object.defineProperty(clonedStream, '__thundr_real_stream', { 
                        value: true, 
                        writable: false 
                    });
                    
                    Object.defineProperty(clonedStream, '_manyCamForced', {
                        value: true,
                        writable: false
                    });
                    
                    console.log('🎉 NUCLEAR: ManyCam stream delivered!');
                    return clonedStream;
                    
                } catch (error) {
                    console.log('💀 NUCLEAR: Complete system failure:', error.message);
                    // Last resort: try original getUserMedia
                    return await originalGetUserMedia(constraints);
                }
            };
            
            // Step 3: NUCLEAR Stream Replacement - Replace existing video elements
            setInterval(() => {
                try {
                    const videoElements = document.querySelectorAll('video');
                    videoElements.forEach((video, index) => {
                        if (video.srcObject && !video.srcObject._manyCamForced) {
                            console.log(`🔄 NUCLEAR: Replacing video stream ${index}`);
                            
                            if (manyCamStreamCache) {
                                const newStream = manyCamStreamCache.clone();
                                Object.defineProperty(newStream, '_manyCamForced', {
                                    value: true,
                                    writable: false
                                });
                                video.srcObject = newStream;
                                console.log(`✅ NUCLEAR: Video ${index} now uses ManyCam`);
                            }
                        }
                    });
                } catch (error) {
                    console.log('⚠️ NUCLEAR: Stream replacement error:', error.message);
                }
            }, 2000); // Check every 2 seconds
            
            // Step 4: DOM Mutation Observer - Catch new video elements instantly
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeName === 'VIDEO' && node.srcObject && !node.srcObject._manyCamForced) {
                            console.log('🚨 NUCLEAR: New video element detected, hijacking...');
                            if (manyCamStreamCache) {
                                const newStream = manyCamStreamCache.clone();
                                Object.defineProperty(newStream, '_manyCamForced', {
                                    value: true,
                                    writable: false
                                });
                                node.srcObject = newStream;
                                console.log('✅ NUCLEAR: New video hijacked to ManyCam');
                            }
                        }
                    });
                });
            });
            
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
            
            console.log('🚀 [NUCLEAR] Enhanced WebRTC with COMPLETE ManyCam override + DOM observer initialized');
        """)

    async def goto_thundr(self):
        try:
            print("Lade Thundr.com...")
            await self.page.goto('https://thundr.com/', wait_until='domcontentloaded')
            await asyncio.sleep(random.uniform(3, 5))  # Longer wait
            
            await self.page.screenshot(path=f"debug_step1_loaded_{int(datetime.now().timestamp())}.png")
            print("[OK] Seite geladen - Screenshot gespeichert")
            return True
        except Exception as e:
            print(f"[ERROR] Fehler beim Laden der Seite: {e}")
            return False

    async def enhanced_interest_selection(self):
        """LIVE INTEREST SCRAPING - Get current interests from dropdown"""
        try:
            print("[LIVE] Live Interest Scraping from Dropdown...")
            
            # 1. Click interest input to open dropdown - try multiple selectors
            input_selectors = [
                'input[placeholder="Type your interests..."]',  # Exact from inspector
                'input[placeholder*="interest"]',
                'input[placeholder*="Type"]',
                '.interest-input',
                '[data-testid="interest-input"]'
            ]
            
            input_clicked = False
            for selector in input_selectors:
                try:
                    await self.page.click(selector, timeout=3000)
                    print(f"[OK] Interest input clicked: {selector}")
                    input_clicked = True
                    break
                except Exception as e:
                    print(f"[DEBUG] Input selector failed: {selector}")
                    continue
            
            if not input_clicked:
                print("[ERROR] Could not find interest input field!")
                return await self.fallback_interest_selection()
            
            # 2. Wait for dropdown options to appear with multiple selectors
            dropdown_selectors = [
                'li[role="option"]',
                '.dropdown-option',
                '[data-option]',
                'div[role="option"]',
                '.interest-option'
            ]
            
            dropdown_found = False
            for selector in dropdown_selectors:
                try:
                    await self.page.wait_for_selector(selector, timeout=3000)
                    print(f"[OK] Dropdown found: {selector}")
                    dropdown_found = True
                    await asyncio.sleep(1)  # Brief wait for all options to load
                    break
                except Exception as e:
                    print(f"[DEBUG] Dropdown selector failed: {selector}")
                    continue
            
            if not dropdown_found:
                print("[ERROR] No dropdown appeared after clicking input!")
                # Take screenshot for debugging
                await self.page.screenshot(path=f"debug_no_dropdown_{int(datetime.now().timestamp())}.png")
                return await self.fallback_interest_selection()
            
            # 3. Get ALL current interests from live dropdown
            interest_elements = await self.page.query_selector_all('li[role="option"]')
            all_current_interests = []
            
            print(f"[DEBUG] Found {len(interest_elements)} interest elements in dropdown")
            
            for i, element in enumerate(interest_elements):
                try:
                    text = await element.inner_text()
                    if text and text.strip():
                        all_current_interests.append(text.strip())
                        print(f"[DEBUG] Interest {i+1}: '{text.strip()}'")
                except Exception as e:
                    print(f"[DEBUG] Failed to get text from element {i}: {e}")
                    continue
            
            print(f"[LIVE] Found {len(all_current_interests)} live interests")
            
            # 4. Select exactly 33 interests
            if all_current_interests:
                max_select = min(33, len(all_current_interests))
                selected_interests = random.sample(all_current_interests, max_select)
                
                print(f"[TARGET] Attempting to select {max_select} interests from {len(all_current_interests)} available")
                print(f"[INTERESTS] Will try: {', '.join(selected_interests[:10])}{'...' if len(selected_interests) > 10 else ''}")
                
                selected_count = 0
                failed_count = 0
                for interest in selected_interests:
                    try:
                        # Use exact text match from live dropdown
                        selector = f'li[role="option"]:has-text("{interest}")'
                        await self.page.click(selector)
                        selected_count += 1
                        print(f"[OK] {interest} selected ({selected_count})")
                        await asyncio.sleep(0.1)  # Faster for 33 selections
                        
                    except Exception as e:
                        failed_count += 1
                        print(f"[WARNING] Failed to select {interest}: {str(e)[:50]}...")
                        continue
                
                print(f"[LIVE] Interest selection completed: {selected_count}/{max_select} interests selected (target: 33)")
                print(f"[STATS] Success: {selected_count}, Failed: {failed_count}, Total attempted: {len(selected_interests)}")
                
                # Validation check - ensure we have enough interests
                if selected_count < 15:  # Minimum threshold 
                    print(f"[ERROR] Only {selected_count} interests selected! This is too few. Exiting session.")
                    return False
                elif selected_count < 33:
                    print(f"[WARNING] Only {selected_count}/33 interests selected. Site may have limits.")
                else:
                    print(f"[SUCCESS] {selected_count} interests selected - target achieved!")
                
                print(f"[ENHANCED] Interest Selection abgeschlossen: {selected_count} Interests")
                return True
            else:
                print("[WARNING] No interests found in dropdown - continuing anyway")
                return True
                
        except Exception as e:
            print(f"[ERROR] Live interest scraping failed: {e}")
            # Fallback to old method
            print("[FALLBACK] Trying cached interests...")
            return await self.fallback_interest_selection()

    async def fallback_interest_selection(self):
        """Fallback method if live scraping fails - try typing interests"""
        try:
            print("[FALLBACK] Trying typed interest selection...")
            interests_to_try = self.session_interests[:15]  # Try first 15 interests
            selected_count = 0
            
            # Find the interest input field
            input_selectors = [
                'input[placeholder="Type your interests..."]',
                'input[placeholder*="interest"]',
                'input[placeholder*="Type"]'
            ]
            
            input_field = None
            for selector in input_selectors:
                try:
                    input_field = await self.page.query_selector(selector)
                    if input_field and await input_field.is_visible():
                        print(f"[FALLBACK] Found input field: {selector}")
                        break
                except:
                    continue
            
            if not input_field:
                print("[ERROR] No input field found for fallback!")
                return False
            
            for interest in interests_to_try:
                try:
                    # Clear and type the interest
                    await input_field.fill("")
                    await asyncio.sleep(0.2)
                    await input_field.fill(interest)
                    await asyncio.sleep(0.5)
                    
                    # Try pressing Enter or Tab to select
                    await input_field.press('Enter')
                    await asyncio.sleep(0.3)
                    
                    selected_count += 1
                    print(f"[FALLBACK] {interest} typed and selected ({selected_count})")
                    
                    if selected_count >= 15:  # Stop after 15 typed interests
                        break
                        
                except Exception as e:
                    print(f"[WARNING] Fallback failed for {interest}: {str(e)[:50]}...")
                    continue
            
            print(f"[FALLBACK] Selected {selected_count} interests (target: 33)")
            
            # Validation check for fallback too
            if selected_count < 5:  # Lower threshold for typed fallback
                print(f"[ERROR] Fallback only selected {selected_count} interests! This is too few. Exiting session.")
                return False
            elif selected_count >= 10:
                print(f"[SUCCESS] Fallback achieved {selected_count} interests - good enough to continue!")
            else:
                print(f"[WARNING] Fallback selected {selected_count} interests. Continuing anyway.")
            
            print(f"[ENHANCED] Interest Selection abgeschlossen: {selected_count} Interests")
            return True
            
        except Exception as e:
            print(f"[ERROR] Fallback interest selection failed: {e}")
            return True

    async def click_video_chat(self):
        try:
            print("Suche nach Video Chat Button...")
            await asyncio.sleep(2)
            
            video_chat_selectors = [
                'button:has-text("Video Chat")',
                'a:has-text("Video Chat")',
                'button:has-text("Start Video")',
                '[data-action="video-chat"]',
                '.video-chat-button',
                'button[class*="video"]'
            ]
            
            for selector in video_chat_selectors:
                try:
                    button = await self.page.wait_for_selector(selector, timeout=5000)
                    if button and await button.is_visible():
                        await button.click()
                        print(f"[OK] Video Chat Button geklickt: {selector}")
                        await asyncio.sleep(3)
                        return True
                except:
                    continue
            
            print("[ERROR] Video Chat Button nicht gefunden")
            return False
            
        except Exception as e:
            print(f"[ERROR] Fehler beim Video Chat Button: {e}")
            return False

    async def handle_i_agree_popup(self):
        try:
            print("Suche nach 'I Agree' Popup...")
            await asyncio.sleep(3)  # Longer wait for popup
            
            agree_selectors = [
                'button:has-text("I Agree")',
                'button:has-text("Agree")',
                'button:has-text("Accept")',
                'button:has-text("Continue")',
                '.agree-button',
                '[data-action="agree"]'
            ]
            
            for selector in agree_selectors:
                try:
                    agree_btn = await self.page.wait_for_selector(selector, timeout=5000)
                    if agree_btn and await agree_btn.is_visible():
                        await agree_btn.click()
                        print(f"[OK] 'I Agree' Popup geschlossen: {selector}")
                        await asyncio.sleep(2)
                        return True
                except:
                    continue
            
            print("[OK] Kein 'I Agree' Popup gefunden")
            return True
            
        except Exception as e:
            print(f"[WARNING] Fehler beim I Agree Popup: {e}")
            return True

    async def enhanced_form_filling(self):
        """ULTRA-FAST form filling with EXACT selectors from user"""
        try:
            print("Fülle Entry Form aus (ULTRA-FAST)...")
            
            # WAIT FOR FORM TO APPEAR
            print("⏳ Waiting for form to appear...")
            try:
                await self.page.wait_for_selector('form', timeout=10000)
                print("✅ Form detected")
            except:
                print("⚠️ No form detected, continuing anyway")
            
            # DEBUG: Log all available inputs and buttons
            print("🔍 DEBUG: Analyzing page elements...")
            try:
                inputs = await self.page.query_selector_all('input')
                buttons = await self.page.query_selector_all('button')
                
                print(f"[DEBUG] Found {len(inputs)} inputs and {len(buttons)} buttons")
                
                for i, inp in enumerate(inputs[:10]):  # Show first 10 inputs
                    try:
                        outer_html = await inp.get_attribute('outerHTML')
                        print(f"[DEBUG] Input {i}: {outer_html[:100]}...")
                    except:
                        pass
                        
                for i, btn in enumerate(buttons[:10]):  # Show first 10 buttons
                    try:
                        text = await btn.inner_text()
                        outer_html = await btn.get_attribute('outerHTML')
                        print(f"[DEBUG] Button {i}: '{text}' - {outer_html[:100]}...")
                    except:
                        pass
                        
            except Exception as e:
                print(f"[DEBUG] Element analysis failed: {e}")
            
            # ULTRA-FAST FORM FILLING - USER'S EXACT METHOD WITH ENHANCED DEBUGGING
            print("🚀 Using ultra-fast form filling method with enhanced debugging")
            
            # 1. Female auswählen with multiple strategies
            print("1️⃣ Selecting Female...")
            female_success = False
            female_selectors = [
                'button:has-text("Female")',
                'input[value="female"]',
                'label:has-text("Female")',
                'span:has-text("Female")',
                '[data-value="female"]'
            ]
            
            for i, selector in enumerate(female_selectors):
                try:
                    print(f"[DEBUG] Trying Female selector {i+1}: {selector}")
                    await self.page.click(selector, timeout=3000)
                    print("✅ Female selected successfully!")
                    female_success = True
                    break
                except Exception as e:
                    print(f"[DEBUG] Female selector {i+1} failed: {str(e)[:100]}")
                    continue
            
            if not female_success:
                print("⚠️ All Female selectors failed, trying radio fallback...")
                try:
                    await self.page.click('span[data-scope="radio-group"][data-part="item-control"][data-state="unchecked"]')
                    print("✅ Female selected via radio fallback")
                except Exception as e:
                    print(f"❌ Female selection failed completely: {e}")
            
            # 2. Looking for Everyone with multiple strategies
            print("2️⃣ Selecting Everyone...")
            everyone_success = False
            everyone_selectors = [
                'button:has-text("Everyone")',
                'input[value="everyone"]',
                'label:has-text("Everyone")',
                'span:has-text("Everyone")',
                '[data-value="everyone"]'
            ]
            
            for i, selector in enumerate(everyone_selectors):
                try:
                    print(f"[DEBUG] Trying Everyone selector {i+1}: {selector}")
                    await self.page.click(selector, timeout=3000)
                    print("✅ Everyone selected successfully!")
                    everyone_success = True
                    break
                except Exception as e:
                    print(f"[DEBUG] Everyone selector {i+1} failed: {str(e)[:100]}")
                    continue
            
            if not everyone_success:
                print("⚠️ All Everyone selectors failed, trying radio fallback...")
                try:
                    radios = await self.page.query_selector_all('span[data-scope="radio-group"][data-part="item-control"]')
                    if len(radios) > 1:  # Click second radio if available
                        await radios[1].click()
                        print("✅ Everyone selected via radio fallback")
                except Exception as e:
                    print(f"❌ Everyone selection failed completely: {e}")
            
            # 3. Birth date with EXACT selectors from user
            start = datetime(2002, 1, 1)
            end = datetime(2004, 1, 1)
            delta = end - start
            random_days = random.randint(0, delta.days)
            dob = start + timedelta(days=random_days)
            day = dob.strftime('%d')
            month = dob.strftime('%m')
            year = dob.strftime('%Y')
            print(f"🎂 Generated birth date: {day}.{month}.{year}")
            
            print("3️⃣ Filling birth date with EXACT selectors...")
            
            # Month field - EXACT selector from user
            try:
                await self.page.fill('input[placeholder="MM"].chakra-input.css-jl32rx', month, timeout=5000)
                print(f"✅ Month filled: {month}")
            except Exception as e:
                print(f"❌ Month field failed: {str(e)[:100]}")
            
            # Day field - EXACT selector from user  
            try:
                await self.page.fill('input[placeholder="DD"].chakra-input.css-jl32rx', day, timeout=5000)
                print(f"✅ Day filled: {day}")
            except Exception as e:
                print(f"❌ Day field failed: {str(e)[:100]}")
            
            # Year field - EXACT selector from user
            try:
                await self.page.fill('input[placeholder="YYYY"].chakra-input.css-jl32rx', year, timeout=5000)
                print(f"✅ Year filled: {year}")
            except Exception as e:
                print(f"❌ Year field failed: {str(e)[:100]}")
            
            # 4. Terms checkbox with multiple strategies
            print("4️⃣ Activating terms checkbox...")
            terms_selectors = [
                'input[type="checkbox"]',
                'svg[data-state="unchecked"]',
                '[role="checkbox"]',
                'label:has-text("terms")',
                'label:has-text("agree")'
            ]
            
            for i, selector in enumerate(terms_selectors):
                try:
                    print(f"[DEBUG] Trying terms selector {i+1}: {selector}")
                    await self.page.click(selector, timeout=3000)
                    print("✅ Terms checkbox activated")
                    break
                except Exception as e:
                    print(f"[DEBUG] Terms selector {i+1} failed: {str(e)[:100]}")
                    continue
            
            # Brief pause before start button
            await asyncio.sleep(1)
            
            # 5. Start Button with multiple strategies
            print("5️⃣ Clicking Start Button...")
            start_selectors = [
                'button:has-text("Start")',
                'button[type="button"].chakra-button',
                'button.css-fw0t89',
                'button:has-text("Begin")',
                'button[data-action="start"]',
                'input[type="submit"]'
            ]
            
            start_clicked = False
            for i, selector in enumerate(start_selectors):
                try:
                    print(f"[DEBUG] Trying start selector {i+1}: {selector}")
                    await self.page.click(selector, timeout=3000)
                    print("✅ Start button clicked successfully!")
                    start_clicked = True
                    break
                except Exception as e:
                    print(f"[DEBUG] Start selector {i+1} failed: {str(e)[:100]}")
                    continue
            
            if not start_clicked:
                print("❌ All Start button selectors failed!")
            
            await asyncio.sleep(5)  # Longer wait after form submission
            
            # Check for any warnings or errors
            await self.handle_fake_video_warnings()
            
            # Take screenshot after form completion
            await self.page.screenshot(path=f"debug_form_complete_{int(datetime.now().timestamp())}.png")
            print("[OK] Entry Form ausgefüllt - Screenshot gespeichert")
            
            # Additional wait to ensure we reach chat window
            print("[INFO] Warte auf Chat Window...")
            await asyncio.sleep(5)
            
            return True
            
        except Exception as e:
            print(f"[ERROR] Fehler beim Enhanced Form Filling: {e}")
            return True

    async def handle_fake_video_warnings(self):
        try:
            print("[SHIELD] Pruefe auf Fake Video Warnings...")
            await asyncio.sleep(1)
            
            warning_selectors = [
                'text="fake video"',
                'text="Fake Video"',
                'text="fake camera"',
                '[data-warning="fake-video"]',
                '*:has-text("fake"):visible'
            ]
            
            warning_found = False
            for selector in warning_selectors:
                try:
                    warning = await self.page.query_selector(selector)
                    if warning and await warning.is_visible():
                        print("[WARNING] Fake video warning detected!")
                        warning_found = True
                        break
                except:
                    continue
            
            if not warning_found:
                print("[OK] Keine Fake Video Warnings gefunden")
            
            return True
            
        except Exception as e:
            print(f"[WARNING] Fehler beim Fake Video Warning Check: {e}")
            return True

    async def wait_for_chat_window(self):
        """Enhanced chat window detection"""
        try:
            print("[CHAT] Erweiterte Chat Window Erkennung...")
            
            # Multiple strategies to detect chat window
            chat_indicators = [
                'input[placeholder*="message"]',
                'textarea[placeholder*="message"]', 
                'input[placeholder*="type"]',
                'textarea[placeholder*="type"]',
                '.chat-input',
                '.message-input',
                '[data-testid="chat-input"]',
                '[role="textbox"]',
                'input[type="text"]:visible',
                '.chat-container',
                '.video-chat-container'
            ]
            
            chat_window_found = False
            for attempt in range(3):  # Try 3 times
                print(f"[CHAT] Versuch {attempt + 1}/3 - Suche Chat Window...")
                
                for selector in chat_indicators:
                    try:
                        element = await self.page.wait_for_selector(selector, timeout=10000)
                        if element and await element.is_visible():
                            print(f"[SUCCESS] Chat Window gefunden: {selector}")
                            chat_window_found = True
                            return element
                    except:
                        continue
                
                if not chat_window_found:
                    print(f"[INFO] Chat Window nicht gefunden, warte 10s...")
                    await asyncio.sleep(10)
                    
                    # Take screenshot for debugging
                    await self.page.screenshot(path=f"debug_chat_search_{attempt}_{int(datetime.now().timestamp())}.png")
            
            if not chat_window_found:
                print("[ERROR] Chat Window nach mehreren Versuchen nicht gefunden")
                return None
                
        except Exception as e:
            print(f"[ERROR] Fehler bei Chat Window Erkennung: {e}")
            return None

    async def chat_loop(self):
        try:
            print("[LOOP] Starte Enhanced Chat-Loop...")
            
            # First, wait for chat window to be available
            chat_input = await self.wait_for_chat_window()
            if not chat_input:
                print("[ERROR] Kann nicht zum Chat Window gelangen")
                return False
            
            chat_count = 0
            while True:
                chat_count += 1
                print(f"\n--- Enhanced Chat #{chat_count} ---")
                
                await self.handle_fake_video_warnings()
                
                # Verify chat input is still available
                try:
                    if not await chat_input.is_visible():
                        print("[INFO] Chat input nicht mehr sichtbar, suche erneut...")
                        chat_input = await self.wait_for_chat_window()
                        if not chat_input:
                            print("[ERROR] Chat input verloren")
                            return False
                except:
                    print("[INFO] Chat input prüfung fehlgeschlagen, suche erneut...")
                    chat_input = await self.wait_for_chat_window()
                    if not chat_input:
                        return False
                
                print("[OK] Partner gefunden! Chat bereit.")
                
                # Send message
                message = random.choice(self.messages)
                try:
                    await chat_input.fill(message)
                    await asyncio.sleep(random.uniform(0.5, 1))
                    await chat_input.press('Enter')
                    print(f"[OK] Nachricht gesendet: {message}")
                except Exception as e:
                    print(f"[WARNING] Fehler beim Nachricht senden: {e}")
                
                # Wait 10 seconds
                print("[WAIT] Warte 10 Sekunden...")
                await asyncio.sleep(10)
                
                # Press ESC twice for new partner
                print("Drücke ESC zweimal für neuen Partner...")
                try:
                    await self.page.keyboard.press('Escape')
                    await asyncio.sleep(0.5)
                    print("[OK] Erster ESC gedrückt")
                    
                    await self.page.keyboard.press('Escape')
                    await asyncio.sleep(2)
                    print("[OK] Zweiter ESC gedrückt")
                    
                    await self.handle_boost_popup()
                    
                except Exception as e:
                    print(f"[WARNING] Fehler beim ESC drücken: {e}")
                
                await asyncio.sleep(random.uniform(3, 6))
                
                if chat_count % 3 == 0:
                    await self.page.screenshot(path=f"debug_enhanced_chat_{chat_count}_{int(datetime.now().timestamp())}.png")
                    print(f"[DEBUG] Screenshot nach {chat_count} Chats")
                
        except Exception as e:
            print(f"[ERROR] Fehler im Enhanced Chat-Loop: {e}")
            return False

    async def handle_boost_popup(self):
        try:
            print("[CHECK] Pruefe auf 'Buy A Boost' Popup...")
            await asyncio.sleep(2)
            
            maybe_later_selectors = [
                'button:has-text("Maybe Later")',
                'button:has-text("Later")',
                'button:has-text("Skip")',
                'button:has-text("No Thanks")'
            ]
            
            popup_found = False
            for selector in maybe_later_selectors:
                try:
                    maybe_later_btn = await self.page.query_selector(selector)
                    if maybe_later_btn and await maybe_later_btn.is_visible():
                        await maybe_later_btn.click()
                        print("[OK] 'Maybe Later' Button geklickt")
                        popup_found = True
                        await asyncio.sleep(1)
                        break
                except:
                    continue
            
            if not popup_found:
                print("[OK] Kein 'Buy A Boost' Popup gefunden")
            
            return True
            
        except Exception as e:
            print(f"[WARNING] Fehler beim Boost-Popup-Handling: {e}")
            return True

    async def cleanup(self):
        try:
            if self.page:
                await self.page.close()
            if self.context:
                await self.context.close()
            if self.browser:
                await self.browser.close()
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")

    async def run_session(self, max_wait_time=60):
        proxy = self.get_next_proxy()
        if proxy:
            print(f"\n[Proxy] Verwende Proxy: {proxy['host']}:{proxy['port']}")
        else:
            print(f"\n[Kein Proxy] Direktverbindung")
            
        try:
            self.init_session_data()
            
            await self.setup_browser(proxy)
            print("Browser gestartet mit Enhanced WebRTC-Spoofing...")
            
            # 1. Load page
            if not await self.goto_thundr():
                return False
            
            # 2. Enhanced interest selection
            if not await self.enhanced_interest_selection():
                return False
            
            # 3. Video Chat Button
            if not await self.click_video_chat():
                return False
            
            # 4. I Agree Popup
            if not await self.handle_i_agree_popup():
                return False
            
            # 5. Enhanced Form Filling
            if not await self.enhanced_form_filling():
                return False
            
            # 6. Enhanced Chat-Loop
            chat_success = await self.chat_loop()
            
            if chat_success:
                print("[SUCCESS] Enhanced Chat-Loop erfolgreich abgeschlossen!")
                return True
            else:
                print("[WARNING] Enhanced Chat-Loop beendet")
                return False
                
        except Exception as e:
            print(f"[ERROR] Session-Fehler: {e}")
            return False
        finally:
            await self.cleanup()
            print("Browser bereinigt.")

async def main():
    print('🚀 === ULTRA-FAST THUNDR BOT - SPEED OPTIMIZED ===')
    print('⚡ Maximum speed, minimal delays, comprehensive logging')
    print('🔄 Auto-restart on timeouts, 33 interests per session')
    
    proxies = []
    print(f'Proxy-Liste: {len(proxies)} Proxys (Debug-Modus ohne Proxy)')
    
    messages = [
        "Write me on Snapchat for Free nude ;* Snapchat : LaLiLuLaara"
    ]
    
    bot = ThundrBot(proxies=proxies, messages=messages)
    max_sessions = 100  # Continuous ultra-fast sessions
    session_count = 0
    
    # Create logs directory for debug reports
    os.makedirs("logs", exist_ok=True)
    
    while session_count < max_sessions:
        print(f"\n=== [ENHANCED] STARTE BOT-SESSION {session_count + 1}/{max_sessions} ===")
        
        try:
            success = await bot.run_session(max_wait_time=60)
            
            if success:
                print(f"[SUCCESS] Enhanced Session {session_count + 1} erfolgreich abgeschlossen")
            else:
                print(f"[WARNING] Enhanced Session {session_count + 1} beendet (Neustart nötig)")
            
        except Exception as e:
            print(f"[ERROR] Fehler in Enhanced Session {session_count + 1}: {e}")
        
        session_count += 1
        
        if session_count < max_sessions:
            wait_time = random.uniform(3, 8)
            print(f"[WAIT] Warte {wait_time:.1f}s vor nächster Session...")
            await asyncio.sleep(wait_time)
    
    print("[FINISH] Alle Enhanced Sessions abgeschlossen!")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        print(f'[ERROR] Enhanced Hauptprogramm-Fehler: {e}') 