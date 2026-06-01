import DB from './db.js';
import API from './api.js';
import CVEngine from './cv_engine.js';

const app = {
    async init() {
        lucide.createIcons();
        this.setupEventListeners();
        this.checkAuth();
        this.updateDashboard();
        this.initHeroViz();
        this.renderLibrary();
        this.renderHistory();
        this.renderAnalytics();
        
        // Handle dark mode
        const theme = localStorage.getItem('theme') || 'light';
        document.body.setAttribute('data-theme', theme);
        const toggle = document.getElementById('dark-mode-toggle');
        if (toggle) toggle.checked = theme === 'dark';

        this.showLoading(false);
        this.navigateTo('login');
    },

    setupEventListeners() {
        // OTP Request
        const requestOtpForm = document.getElementById('request-otp-form');
        if (requestOtpForm) {
            requestOtpForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('login-email').value;
                this.showLoading(true);
                // Simulate sending OTP
                await API.delay(1000);
                this.showLoading(false);
                this.showLoginStep(2);
            });
        }

        // OTP Verification
        const verifyOtpBtn = document.getElementById('verify-otp-btn');
        if (verifyOtpBtn) {
            verifyOtpBtn.onclick = async () => {
                const otp = Array.from(document.querySelectorAll('.otp-input')).map(i => i.value).join('');
                if (otp.length === 4) {
                    this.showLoading(true);
                    await API.login(document.getElementById('login-email').value, 'otp-logic');
                    this.checkAuth();
                    this.showLoading(false);
                    this.navigateTo('dashboard');
                    this.updateDashboard();
                } else {
                    alert('Please enter a valid 4-digit OTP');
                }
            };
        }

        // OTP Input Auto-focus
        document.querySelectorAll('.otp-input').forEach((input, idx, inputs) => {
            input.addEventListener('input', (e) => {
                if (e.target.value && idx < inputs.length - 1) {
                    inputs[idx + 1].focus();
                }
            });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !e.target.value && idx > 0) {
                    inputs[idx - 1].focus();
                }
            });
        });

        // Theme toggle from desktop header
        const themeBtn = document.getElementById('theme-toggle');
        if (themeBtn) {
            themeBtn.onclick = () => this.toggleDarkMode();
        }
    },

    showLoginStep(step) {
        document.getElementById('login-step-1').classList.toggle('hidden', step !== 1);
        document.getElementById('login-step-2').classList.toggle('hidden', step !== 2);
    },

    navigateTo(screenId, poseName) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const target = document.getElementById(`screen-${screenId}`);
        if (target) target.classList.add('active');
        
        // Update nav active states
        document.querySelectorAll('.nav-item').forEach(n => {
            n.classList.remove('active');
            if (n.id === `nav-${screenId}`) n.classList.add('active');
        });

        // Initialize specific screen logic
        if (screenId === 'camera') {
            this.currentPose = poseName || 'Tadasana';
            this.initCameraSession();
        } else if (screenId === 'profile') {
            CVEngine.stopTracking();
            this.stopYoutubePlayer();
            this.initProfileScreen();
        } else {
            CVEngine.stopTracking();
            this.stopYoutubePlayer();
            if (screenId === 'analytics') this.renderAnalytics();
            else if (screenId === 'health') this.renderHistory();
            
            if (screenId === 'landing') {
                const dbData = DB.get();
                if (dbData) {
                    dbData.currentUser = null;
                    DB.save(dbData);
                }
                const authBtn = document.getElementById('auth-btn');
                if (authBtn) {
                    authBtn.innerText = 'Sign In';
                    authBtn.onclick = () => this.navigateTo('login');
                }
            }
        }

        window.scrollTo(0, 0);
        lucide.createIcons();

        // Toggle navbars based on screen
        const isAuth = ['landing', 'login', 'signup'].includes(screenId);
        const desktopHeader = document.querySelector('.desktop-header');
        const mobileNav = document.querySelector('.mobile-nav');
        
        if (desktopHeader) {
            desktopHeader.style.display = (isAuth && screenId !== 'landing') ? 'none' : (window.innerWidth > 768 ? 'flex' : 'none');
            // Show header on landing (web) but hide on login/signup
            if (screenId === 'landing' && window.innerWidth > 768) desktopHeader.style.display = 'flex';
            else if (['login', 'signup'].includes(screenId)) desktopHeader.style.display = 'none';
        }
        
        if (mobileNav) {
            mobileNav.style.display = isAuth ? 'none' : (window.innerWidth <= 768 ? 'flex' : 'none');
        }
    },

    async handleLogin(email, pass) {
        this.showLoading(true);
        const res = await API.login(email, pass);
        this.showLoading(false);
        if (res.success) {
            this.checkAuth();
            this.navigateTo('dashboard');
            this.updateDashboard();
        }
    },

    async updateDashboard() {
        const stats = await API.getWellnessStats();
        const streakEl = document.getElementById('dash-streak');
        const hydrationEl = document.getElementById('dash-hydration');
        const stepsEl = document.getElementById('dash-steps');

        if (streakEl) streakEl.innerText = stats.streak;
        if (hydrationEl) hydrationEl.innerText = `${stats.hydration.toFixed(1)}L`;
        if (stepsEl) stepsEl.innerText = stats.steps.toLocaleString();
    },

    renderLibrary() {
        const poses = [
            { name: 'Vajrasana', benefit: 'Improves digestion, regulates sugar', diff: 'Beginner', time: '5m' },
            { name: 'Surya Namaskar', benefit: 'Full body metabolic boost', diff: 'Intermediate', time: '15m' },
            { name: 'Tadasana', benefit: 'Improves posture & focus', diff: 'Beginner', time: '3m' },
            { name: 'Bhujangasana', benefit: 'Strengthens spine, opens chest', diff: 'Beginner', time: '5m' }
        ];

        const grid = document.getElementById('library-grid');
        if (!grid) return;

        grid.innerHTML = poses.map(pose => `
            <div class="card pose-lib-card">
                <div class="pose-img-placeholder"></div>
                <div class="pose-lib-info">
                    <h4>${pose.name}</h4>
                    <p class="benefit">${pose.benefit}</p>
                    <div class="pose-meta">
                        <span><i data-lucide="clock"></i> ${pose.time}</span>
                        <span><i data-lucide="bar-chart"></i> ${pose.diff}</span>
                    </div>
                    <button class="btn btn-sm btn-primary btn-block" onclick="app.navigateTo('camera', '${pose.name}')">Start Practice</button>
                </div>
            </div>
        `).join('');
    },

    async renderHistory() {
        const history = await API.getHistory();
        const tbody = document.querySelector('#history-table tbody');
        if (!tbody) return;

        tbody.innerHTML = history.map(h => `
            <tr>
                <td>${h.date}</td>
                <td>${h.pose}</td>
                <td>${h.duration}</td>
                <td class="${h.accuracy > 90 ? 'text-success' : ''}">${h.accuracy}%</td>
            </tr>
        `).join('');

        // Update water UI
        const stats = await API.getWellnessStats();
        const bar = document.getElementById('water-bar');
        const text = document.getElementById('water-text');
        if (bar && text) {
            const perc = Math.min((stats.hydration / 2) * 100, 100);
            bar.style.width = `${perc}%`;
            text.innerText = `${stats.hydration.toFixed(1)}L / 2L`;
        }
    },

    renderAnalytics() {
        const consistencyChart = document.getElementById('consistency-chart');
        if (consistencyChart) {
            consistencyChart.innerHTML = `
                <svg viewBox="0 0 400 150" class="svg-chart">
                    <rect x="10" y="100" width="40" height="40" fill="var(--primary)" rx="4" />
                    <rect x="70" y="60" width="40" height="80" fill="var(--primary)" rx="4" />
                    <rect x="130" y="80" width="40" height="60" fill="var(--primary)" rx="4" />
                    <rect x="190" y="30" width="40" height="110" fill="var(--secondary)" rx="4" />
                    <rect x="250" y="50" width="40" height="90" fill="var(--primary)" rx="4" />
                    <rect x="310" y="90" width="40" height="50" fill="var(--primary)" rx="4" />
                    <rect x="370" y="40" width="40" height="100" fill="var(--primary)" rx="4" />
                </svg>
            `;
        }
        
        const insight = document.getElementById('ai-insight-text');
        if (insight) {
            insight.innerText = "Great job! Your consistency has increased by 15% this week. Maintaining Vajrasana post-dinner is helping stabilize your overnight glucose trends.";
        }
    },

    addWater() {
        API.updateHydration(0.25).then(() => {
            this.renderHistory();
            this.updateDashboard();
        });
    },

    calcBMI() {
        const w = document.getElementById('bmi-weight').value;
        const h = document.getElementById('bmi-height').value / 100;
        if (w && h) {
            const bmi = (w / (h * h)).toFixed(1);
            let cat = '';
            if (bmi < 18.5) cat = 'Underweight';
            else if (bmi < 25) cat = 'Normal';
            else if (bmi < 30) cat = 'Overweight';
            else cat = 'Obese';
            document.getElementById('bmi-result').innerText = `Your BMI is ${bmi} (${cat})`;
        }
    },

    initHeroViz() {
        const canvas = document.getElementById('hero-canvas');
        if (canvas) {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
            CVEngine.startTracking(canvas);
        }
    },

    stopYoutubePlayer() {
        const playerContainer = document.getElementById('youtube-player-container');
        const player = document.getElementById('youtube-player');
        const cover = document.getElementById('video-watermark-cover');
        if (playerContainer) {
            playerContainer.classList.add('hidden');
        }
        if (player) {
            player.src = '';
        }
        if (cover) {
            cover.classList.add('hidden');
        }
        const canvas = document.getElementById('camera-canvas');
        if (canvas) {
            canvas.classList.remove('hidden');
        }
    },

    initCameraSession() {
        const canvas = document.getElementById('camera-canvas');
        const playerContainer = document.getElementById('youtube-player-container');
        const player = document.getElementById('youtube-player');
        const cover = document.getElementById('video-watermark-cover');
        const btn = document.getElementById('session-btn');
        const instruction = document.getElementById('ai-instruction');
        const meter = document.getElementById('accuracy-fill');
        
        // Reset controls
        if (btn) {
            btn.innerText = "Start Session";
            btn.className = "btn btn-primary";
        }
        if (meter) {
            meter.style.width = "0%";
        }
        
        if (this.currentPose === 'Vajrasana' || this.currentPose === 'Surya Namaskar' || this.currentPose === 'Tadasana' || this.currentPose === 'Bhujangasana') {
            // Hide canvas and stop tracking
            CVEngine.stopTracking();
            if (canvas) canvas.classList.add('hidden');
            
            // Toggle watermark cover based on pose
            if (cover) {
                if (this.currentPose === 'Surya Namaskar') {
                    cover.classList.remove('hidden');
                } else {
                    cover.classList.add('hidden');
                }
            }

            // Show YouTube player with correct video
            if (playerContainer && player) {
                playerContainer.classList.remove('hidden');
                if (this.currentPose === 'Vajrasana') {
                    player.src = 'https://www.youtube.com/embed/fSKBk9u9tP8?autoplay=1&mute=1';
                } else if (this.currentPose === 'Surya Namaskar') {
                    player.src = 'https://www.youtube.com/embed/l1C0rD_DlUE?autoplay=1&mute=1';
                } else if (this.currentPose === 'Tadasana') {
                    player.src = 'https://www.youtube.com/embed/9eNMoDT2I-k?autoplay=1&mute=1';
                } else if (this.currentPose === 'Bhujangasana') {
                    player.src = 'https://www.youtube.com/embed/Y8UNFem5qHc?autoplay=1&mute=1';
                }
            }
            if (instruction) {
                instruction.innerText = `Follow the ${this.currentPose} posture video demonstration`;
            }
        } else {
            // Show canvas and start tracking
            this.stopYoutubePlayer();
            if (canvas) {
                canvas.classList.remove('hidden');
                canvas.width = canvas.offsetWidth;
                canvas.height = canvas.offsetHeight;
                CVEngine.startTracking(canvas);
            }
            if (instruction) instruction.innerText = "Align your body within the frame";
        }
        
        if (btn) {
            btn.onclick = () => {
                const isVideoPose = ['Vajrasana', 'Surya Namaskar', 'Tadasana', 'Bhujangasana'].includes(this.currentPose);
                if (btn.innerText === "Start Session") {
                    btn.innerText = "Stop Session";
                    btn.classList.replace('btn-primary', 'btn-danger');
                    if (instruction) {
                        instruction.innerText = `✅ Pose Detected: ${this.currentPose}. Hold still...`;
                    }
                    if (meter) {
                        meter.style.width = isVideoPose ? "96%" : "95%";
                    }
                } else {
                    const acc = isVideoPose ? 96 : 94;
                    API.saveSession({ pose: this.currentPose, duration: '5m', accuracy: acc });
                    this.navigateTo('dashboard');
                }
            };
        }
    },

    initProfileScreen() {
        const db = DB.get();
        const user = db ? db.currentUser : null;
        if (!user) {
            alert('Please login first');
            this.navigateTo('login');
            return;
        }

        // Set inputs
        document.getElementById('profile-email').value = user.email || '';
        document.getElementById('profile-name').value = user.name || '';
        document.getElementById('profile-mobile').value = user.mobile || '';
        document.getElementById('profile-age').value = user.age || '';
        document.getElementById('profile-gender').value = user.gender || 'Male';
        document.getElementById('profile-diabetic').value = user.diabeticType || 'Type 2';

        // Load avatar preview
        const avatarPreview = document.getElementById('profile-avatar-preview');
        if (user.avatar) {
            avatarPreview.src = user.avatar;
        } else {
            avatarPreview.src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150';
        }

        // Set up event listeners for file upload
        const fileInput = document.getElementById('profile-pic-input');
        if (fileInput) {
            fileInput.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        avatarPreview.src = event.target.result;
                    };
                    reader.readAsDataURL(file);
                }
            };
        }

        // Form Submit
        const form = document.getElementById('profile-form');
        if (form) {
            form.onsubmit = (e) => {
                e.preventDefault();
                
                const dbData = DB.get();
                dbData.currentUser = {
                    ...dbData.currentUser,
                    name: document.getElementById('profile-name').value,
                    mobile: document.getElementById('profile-mobile').value,
                    age: document.getElementById('profile-age').value,
                    gender: document.getElementById('profile-gender').value,
                    diabeticType: document.getElementById('profile-diabetic').value,
                    avatar: avatarPreview.src
                };
                DB.save(dbData);
                
                alert('Profile saved successfully!');
                this.checkAuth(); // Update header name if it changed!
                this.navigateTo('dashboard');
            };
        }
    },

    toggleDarkMode() {
        const current = document.body.getAttribute('data-theme');
        const next = current === 'light' ? 'dark' : 'light';
        document.body.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        
        const toggle = document.getElementById('dark-mode-toggle');
        if (toggle) toggle.checked = next === 'dark';
        
        const themeBtnIcon = document.querySelector('#theme-toggle i');
        if (themeBtnIcon) {
            themeBtnIcon.setAttribute('data-lucide', next === 'dark' ? 'sun' : 'moon');
            lucide.createIcons();
        }
    },

    showLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        if (show) overlay.classList.remove('hidden');
        else overlay.classList.add('hidden');
    },

    checkAuth() {
        const db = DB.get();
        if (db && db.currentUser) {
            const authBtn = document.getElementById('auth-btn');
            if (authBtn) {
                authBtn.innerText = 'Profile';
                authBtn.onclick = () => this.navigateTo('profile');
            }
        }
    },

    async bypassLogin() {
        this.showLoading(true);
        const res = await API.login('guest@example.com', 'bypass');
        this.checkAuth();
        this.showLoading(false);
        this.navigateTo('dashboard');
        this.updateDashboard();
    }
};

window.app = app;
app.init();
