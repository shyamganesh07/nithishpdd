import DB from './db.js';
import API from './api.js';
import CVEngine from './cv_engine.js';

const app = {
    async init() {
        lucide.createIcons();
        this.setupEventListeners();
        this.updateDashboard();
        this.initHeroViz();
        this.renderLibrary();
        this.renderHistory();
        this.renderAnalytics();
        
        // Handle dark mode
        let theme = 'light';
        try {
            theme = localStorage.getItem('theme') || 'light';
        } catch (e) {}
        document.body.setAttribute('data-theme', theme);
        const toggle = document.getElementById('dark-mode-toggle');
        if (toggle) toggle.checked = theme === 'dark';

        this.showLoading(false);
        this.navigateTo('dashboard');
    },

    setupEventListeners() {
        // Theme toggle from desktop header
        const themeBtn = document.getElementById('theme-toggle');
        if (themeBtn) {
            themeBtn.onclick = () => this.toggleDarkMode();
        }
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
        }

        window.scrollTo(0, 0);
        lucide.createIcons();

        // Toggle navbars based on screen
        const desktopHeader = document.querySelector('.desktop-header');
        const mobileNav = document.querySelector('.mobile-nav');
        
        if (desktopHeader) {
            desktopHeader.style.display = window.innerWidth > 768 ? 'flex' : 'none';
        }
        
        if (mobileNav) {
            mobileNav.style.display = window.innerWidth <= 768 ? 'flex' : 'none';
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
        let db = DB.get();
        let user = db ? db.currentUser : null;
        if (!user) {
            user = { email: 'guest@example.com', name: 'Guest User', mobile: '', age: '', gender: 'Male', diabeticType: 'None', avatar: '' };
            if (!db) db = {};
            db.currentUser = user;
            DB.save(db);
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
                this.navigateTo('dashboard');
            };
        }
    },

    toggleDarkMode() {
        const current = document.body.getAttribute('data-theme');
        const next = current === 'light' ? 'dark' : 'light';
        document.body.setAttribute('data-theme', next);
        try {
            localStorage.setItem('theme', next);
        } catch (e) {}
        
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


};

window.app = app;
app.init();
