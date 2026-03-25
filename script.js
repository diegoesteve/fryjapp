(function () {
    // Supabase Configuration
    const SUPABASE_URL = 'https://mmoaptsmulsuvdtepiot.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tb2FwdHNtdWxzdXZkdGVwaW90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MDgwNTgsImV4cCI6MjA4NDk4NDA1OH0.yvk_xOmDQFLgqNmvjJUd9Cnwvvm90Bnd26MrlyJj6bU';
    let supabase;


    // State
    const state = {
        services: [], // Will be fetched from DB
        professionals: [], // Will be fetched from DB
        bookings: [], // Will be fetched from DB
        inventoryProducts: [], // Will be fetched from DB
        inventoryRequests: [], // Will be fetched from DB
        inventoryVials: [], // Temporary mock for injectable tracking
        currentUser: null, // Managed by Supabase Auth
        currentView: 'home',
        bookingFor: null,
        rescheduleId: null,
        patients: [], // Managed by profiles query
        visits: [],

        // UI Filters
        adminFilters: { professionalId: '', status: '', month: '' },
        reportFilters: { startDate: '', endDate: '', professionalId: '' },
        serviceFilters: { status: '', category: '', professionalId: '' },
        agendaView: { viewMode: 'month', calendarMonth: new Date().getMonth(), calendarYear: new Date().getFullYear(), selectedDay: new Date() },
        visibleServicesCount: 4,
        isLoading: false,
        settings: {
            clinicName: 'ElevaMed',
            email: 'hola@elevamed.ar',
            phone: '+54 11 1234-5678',
            address: 'Av. Corrientes 1234, CABA',
            currency: 'ARS',
            primaryColor: '#8b5cf6'
        }
    };

    // App Logic
    const turnoApp = {
        async init() {

            // Core initialization
            try {
                // 0. Check dependencies
                if (!window.supabase) {
                    throw new Error("Librería de conexión no disponible. Por favor verificá tu conexión a internet.");
                }
                // Initialize global client
                supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

                // 0.5 Load Settings from LocalStorage & Apply Theme
                const localSettings = localStorage.getItem('lumina_clinic_settings');
                if (localSettings) {
                    state.settings = { ...state.settings, ...JSON.parse(localSettings) };
                }
                const localPatients = localStorage.getItem('lumina_patients');
                if (localPatients) {
                    state.patients = JSON.parse(localPatients);
                }
                document.documentElement.style.setProperty('--primary', state.settings.primaryColor);
                this.updateBranding();

                // 1. Check Session
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    await this.fetchUserProfile(session.user.id);
                }

                // 2. Load Data in Parallel
                await Promise.all([
                    this.fetchServices(),
                    this.fetchProfessionals(),
                    this.fetchInventoryProducts()
                ]);

                // 2.5 Load Mock Vials Support for the Treatment Chart
                await this.fetchInventoryVials();

                // Also fetch requests if logged in
                if (session) {
                    await this.fetchInventoryRequests();
                }

                // 3. UI
                this.renderHome();
                this.updateIcons();
                this.updateNav();

                // Listen for Auth Changes
                supabase.auth.onAuthStateChange(async (event, session) => {
                    if (event === 'SIGNED_IN' && session) {
                        await this.fetchUserProfile(session.user.id);
                        await this.fetchBookings();
                    } else if (event === 'SIGNED_OUT') {
                        state.currentUser = null;
                        state.bookings = [];
                    }
                    this.updateNav();
                });

                // Handle Browser Back Button
                window.onpopstate = (event) => {
                    if (event.state) {
                        this.navigate(event.state.view, event.state.params, false);
                    } else {
                        this.navigate('home', null, false);
                    }
                };

            } catch (error) {
                console.error("Init Error:", error);
                // Fallback UI if toast not ready
                const msg = error.message || "Error de conexión";
                this.renderError(msg);
            }

            // Insert Modal HTML on init
            if (!document.getElementById('modal-overlay')) {
                document.body.insertAdjacentHTML('beforeend', `
                <div id="modal-overlay" class="modal-overlay">
                    <div id="modal-content" class="modal-content"></div>
                </div>
                <div id="toast" class="toast"></div>
                <a href="https://wa.me/1234567890" class="whatsapp-float" target="_blank" title="Consultar por WhatsApp">
                    <i data-lucide="message-circle" width="32" height="32"></i>
                </a>
            `);
            }
        },

        async fetchUserProfile(userId) {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (data) {
                state.currentUser = data;
            }
        },

        async fetchServices() {
            const { data, error } = await supabase.from('services').select('*').order('id');
            if (data) state.services = data;
        },

        async fetchProfessionals() {
            const { data, error } = await supabase.from('professionals').select('*').order('id');
            if (data) {
                // Map snake_case DB fields to camelCase for frontend
                state.professionals = data.map(p => ({
                    ...p,
                    serviceIds: p.service_ids || [],
                    image: p.image_url
                }));
            }
        },

        async fetchInventoryProducts() {
            const { data, error } = await supabase.from('products').select('*, stock:inventory_stock(*)').order('name');
            if (data) {
                state.inventoryProducts = data.map(p => ({
                    ...p,
                    stock: p.stock && p.stock.length > 0 ? p.stock[0] : { total_quantity: 0, available_quantity: 0, reserved_quantity: 0 }
                }));
            }
        },

        async fetchInventoryVials() {
            // Mock Vials data until inventory_vials table exists
            state.inventoryVials = [
                { id: 1, product_id: 1, asset_code: 'BXT-2024-001', lot: 'L2301A', expiration_date: '2025-12-31', available_quantity: 100 },
                { id: 2, product_id: 1, asset_code: 'BXT-2024-002', lot: 'L2302A', expiration_date: '2025-12-31', available_quantity: 50 },
                { id: 3, product_id: 2, asset_code: 'HA-2024-001', lot: 'L2305B', expiration_date: '2025-06-30', available_quantity: 2 }
            ];
            
            // Map product IDs dynamically if db IDs differ from mock IDs for injectables (vial unit_type)
            const vialProducts = state.inventoryProducts.filter(p => p.unit_type === 'vial');
            if (vialProducts.length > 0) {
                state.inventoryVials[0].product_id = vialProducts[0].id;
                state.inventoryVials[1].product_id = vialProducts[0].id;
                if (vialProducts.length > 1) {
                    state.inventoryVials[2].product_id = vialProducts[1].id;
                }
            }
        },

        async fetchInventoryRequests() {
            const { data, error } = await supabase.from('inventory_orders').select('*, profiles:professional_id(name), items:inventory_order_items(*, product:products(name, unit_type))').order('created_at', { ascending: false });
            if (data) state.inventoryRequests = data;
        },

        navigate(view, params = null, pushState = true) {
            // Auth Guards
            if (view === 'admin' && (!state.currentUser || state.currentUser.role !== 'admin' && state.currentUser.role !== 'professional')) {
                return this.navigate('login');
            }
            if (view === 'dashboard' && (!state.currentUser || (state.currentUser.role !== 'admin' && state.currentUser.role !== 'professional'))) {
                return this.navigate('login');
            }
            if (view === 'my-bookings' && !state.currentUser) {
                return this.navigate('login');
            }
            if (view === 'booking' && !state.currentUser) {
                this.selectedService = this.selectedService || params; // Preserve service selection
                this.navigate('login');
                // Store intent
                localStorage.setItem('lumina_pending_action', JSON.stringify({ serviceId: this.selectedService }));
                this.showNotification('Debes iniciar sesión para reservar');
                return;
            }

            // Push History
            if (pushState) {
                const url = view === 'home' ? '/' : `#${view}`;
                history.pushState({ view, params }, '', url);
            }

            state.currentView = view;

            switch (view) {
                case 'home':
                    this.renderHome();
                    break;
                case 'dashboard':
                    this.renderDashboard();
                    break;
                case 'services':
                    this.renderServices();
                    break;
                case 'service-detail':
                    this.renderServiceDetail(params);
                    break;
                case 'professionals':
                    this.renderProfessionals();
                    break;
                case 'professional-profile':
                    this.renderProfessionalProfile(params);
                    break;
                case 'booking':
                    this.renderBooking();
                    break;
                case 'admin':
                    this.renderAdmin();
                    break;
                case 'reports':
                    this.renderReports();
                    break;
                case 'login':
                    this.renderLogin();
                    break;
                case 'register':
                    this.renderRegister();
                    break;
                case 'my-bookings':
                    this.renderMyBookings();
                    break;
                case 'patients':
                    this.renderPatients();
                    break;
                case 'patient-profile':
                    this.renderPatientProfile(params);
                    break;
                case 'services-management': // New case for service management
                    this.renderServicesManagement();
                    break;
                case 'professionals-management':
                    this.renderProfessionalsManagement();
                    break;
                case 'inventory':
                    this.renderInventoryManagement();
                    break;
                case 'settings':
                    this.renderSettings();
                    break;
                default:
                    this.renderHome();
            }
            window.scrollTo(0, 0);
            this.updateIcons();
            this.updateNav();
        },

        async login(email, password) {
            // DEBUG: Remove after verification
            console.log(`Intento de login: ${email}`);

            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {
                alert('Credenciales inválidas');
                return;
            }

            await this.fetchUserProfile(data.user.id);

            // Restore pending action or go home
            const pending = localStorage.getItem('lumina_pending_action');
            if (pending) {
                const { serviceId, professionalId } = JSON.parse(pending);
                localStorage.removeItem('lumina_pending_action');
                this.navigate('booking');
                // Note: We might want to pre-select, but navigate 'booking' usually handles the view.
                if (serviceId) this.selectedService = serviceId;
                if (professionalId) this.selectedProfessional = professionalId;
            } else {
                this.navigate('dashboard');
            }
            this.updateNav();
        },

        async logout() {
            await supabase.auth.signOut();
            state.currentUser = null;
            state.bookingFor = null;
            this.navigate('home');
            this.updateNav();
            this.renderSidebar();
        },

        // Helper to format service prices across the app
        formatServicePrice(service) {
            if (service.priceType === 'variable' && service.priceRange) {
                return service.priceRange;
            }
            return '$' + (service.price || 0);
        },

        forgotPassword() {
            const email = prompt('Por favor ingresa tu email para recuperar tu contraseña:');
            if (email) {
                // ENH-16: Simulate email sending
                this.showNotification(`Se ha enviado un correo de recuperación a ${email}`);
            }
        },

        syncPatients() {
            const bookings = state.bookings;
            const patientMap = new Map();

            // Load existing to preserve manual edits (phone, notes)
            state.patients.forEach(p => patientMap.set(p.email, p));

            bookings.forEach(b => {
                if (!patientMap.has(b.clientEmail)) {
                    patientMap.set(b.clientEmail, {
                        email: b.clientEmail,
                        name: b.clientName,
                        phone: "Sin registrar",
                        firstVisit: b.date,
                        lastVisit: b.date,
                        totalVisits: 1,
                        assignedProfessionalIds: [] // ENH-Assignment: Track specific professionals
                    });
                } else {
                    const p = patientMap.get(b.clientEmail);
                    if (b.date > p.lastVisit) p.lastVisit = b.date;
                    if (b.date < p.firstVisit) p.firstVisit = b.date;
                    if (!p.assignedProfessionalIds) p.assignedProfessionalIds = []; // Ensure array exists
                    // Recalculate total visits is tricky if we don't reset. 
                    // Simple approach: Recalculate count from scratch?
                }
            });

            // Re-count visits for accuracy
            patientMap.forEach(p => {
                p.totalVisits = bookings.filter(b => b.clientEmail === p.email && b.status !== 'Cancelado').length;
            });

            state.patients = Array.from(patientMap.values());
            localStorage.setItem('lumina_patients', JSON.stringify(state.patients));
        },

        renderSidebar() {
            // Remove existing sidebar if any
            const existing = document.getElementById('sidebar');
            if (existing) existing.remove();

            // Only show for backend roles
            if (!state.currentUser || state.currentUser.role === 'patient') {
                document.body.classList.remove('with-sidebar');
                document.body.classList.remove('sidebar-collapsed');
                return;
            }

            const isCollapsed = state.sidebarCollapsed;
            document.body.classList.add('with-sidebar');
            if (isCollapsed) document.body.classList.add('sidebar-collapsed');

            const menuItems = [
                { id: 'dashboard', icon: 'layout-dashboard', label: 'Resumen', role: ['admin', 'professional'] },
                { id: 'admin', icon: 'calendar', label: 'Agenda', role: ['admin', 'professional'] },
                { id: 'patients', icon: 'users', label: 'Pacientes', role: ['admin', 'professional'] },
                { id: 'services-management', icon: 'sparkles', label: 'Servicios', role: ['admin'] },
                { id: 'professionals-management', icon: 'users-round', label: 'Profesionales', role: ['admin'] },
                { id: 'inventory', icon: 'package', label: 'Inventario', role: ['admin', 'professional'] },
                { id: 'reports', icon: 'bar-chart-3', label: 'Reportes', role: ['admin'] },
                { id: 'settings', icon: 'settings', label: 'Configuración', role: ['admin'] }
            ];

            const sidebarHTML = `
                <aside id="sidebar" class="${isCollapsed ? 'collapsed' : ''}">
                    <div class="sidebar-header">
                        <div class="logo-text">ElevaMed<span style="color:var(--secondary)">.</span></div>
                        <button class="collapse-btn" onclick="turnoApp.toggleSidebar()">
                            <i data-lucide="${isCollapsed ? 'chevrons-right' : 'chevrons-left'}"></i>
                        </button>
                    </div>
                    <nav class="sidebar-nav">
                        ${menuItems.filter(item => item.role.includes(state.currentUser.role)).map(item => `
                            <div class="sidebar-nav-item ${state.currentView === item.id ? 'active' : ''}" 
                                 onclick="turnoApp.navigate('${item.id}')">
                                <i data-lucide="${item.icon}"></i>
                                <span>${item.label}</span>
                            </div>
                        `).join('')}
                    </nav>
                    <div class="sidebar-footer">
                         <div class="sidebar-nav-item" onclick="turnoApp.logout()">
                            <i data-lucide="log-out"></i>
                            <span>Cerrar Sesión</span>
                        </div>
                    </div>
                </aside>
            `;

            document.body.insertAdjacentHTML('afterbegin', sidebarHTML);
            if (window.lucide) lucide.createIcons();
        },

        toggleSidebar() {
            state.sidebarCollapsed = !state.sidebarCollapsed;
            localStorage.setItem('lumina_sidebar_collapsed', state.sidebarCollapsed);

            const sidebar = document.getElementById('sidebar');
            if (sidebar) {
                sidebar.classList.toggle('collapsed');
                const btnIcon = sidebar.querySelector('.collapse-btn i');
                if (btnIcon) {
                    btnIcon.setAttribute('data-lucide', state.sidebarCollapsed ? 'chevrons-right' : 'chevrons-left');
                    if (window.lucide) lucide.createIcons();
                }
            }

            document.body.classList.toggle('sidebar-collapsed');
        },

        updateNav() {
            this.renderSidebar();

            const nav = document.querySelector('.nav-links');
            if (!nav) return;
            const user = state.currentUser;

            let navHtml = `
            <button onclick="turnoApp.navigate('home')" class="nav-btn">Inicio</button>
            <button onclick="turnoApp.navigate('services')" class="nav-btn">Servicios</button>
            <button onclick="turnoApp.navigate('professionals')" class="nav-btn">Profesionales</button>
        `;

            if (user) {
                if (user.role === 'admin') {
                    navHtml += `<button onclick="turnoApp.navigate('admin')" class="nav-btn secondary">Admin</button>`;
                } else if (user.role === 'professional') {
                    navHtml += `<button onclick="turnoApp.navigate('my-bookings')" class="nav-btn">Mis Turnos</button>`;
                } else {
                    navHtml += `<button onclick="turnoApp.navigate('my-bookings')" class="nav-btn">Mis Turnos</button>`;
                }

                navHtml += `<button onclick="turnoApp.logout()" class="nav-btn" style="color: #666;">Salir (${user.name})</button>`;
                if (user.role === 'patient') {
                    navHtml += `<button onclick="turnoApp.startBooking()" class="btn-primary">Reservar</button>`;
                }
            } else {
                navHtml += `<button onclick="turnoApp.navigate('login')" class="nav-btn">Ingresar</button>`;
                navHtml += `<button onclick="turnoApp.startBooking()" class="btn-primary">Reservar Turno</button>`;
            }

            nav.innerHTML = navHtml;
        },

        toggleMenu() {
            const nav = document.querySelector('.nav-links');
            nav.classList.toggle('active');
        },

        startBooking(serviceId = null, professionalId = null, bookingForEmail = null) {
            this.selectedService = serviceId;
            this.selectedProfessional = professionalId;
            state.bookingFor = bookingForEmail; // Set context if booking for someone else

            if (!state.currentUser) {
                this.showNotification('Por favor inicia sesión para reservar');
                // Save context
                const action = { serviceId, professionalId };
                localStorage.setItem('lumina_pending_action', JSON.stringify(action));

                // Legacy/Backup
                localStorage.setItem('lumina_pending_service', this.selectedService || '');

                this.navigate('login');
            } else {
                this.navigate('booking');
            }
        },

        viewService(serviceId) {
            this.clickedService = serviceId; // Store temporarily
            this.navigate('service-detail', serviceId);
        },

        updateIcons() {
            if (window.lucide) {
                window.lucide.createIcons();
            }
        },

        updateBranding() {
            document.title = `${state.settings.clinicName} | Portal de Reservas`;

            const logoEl = document.querySelector('.logo');
            if (logoEl) logoEl.innerHTML = `${state.settings.clinicName}<span>.</span>`;

            const footerText = document.querySelector('.footer p');
            if (footerText) footerText.innerHTML = `&copy; ${new Date().getFullYear()} ${state.settings.clinicName}. Todos los derechos reservados.<br><br>📍 ${state.settings.address} | ✉ ${state.settings.email} | 📞 ${state.settings.phone}`;
        },

        showNotification(message) {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        },

        openModal(content) {
            const overlay = document.getElementById('modal-overlay');
            const modalContent = document.getElementById('modal-content');
            modalContent.innerHTML = content;
            overlay.classList.add('open');

            // Close on click outside
            overlay.onclick = (e) => {
                if (e.target === overlay) this.closeModal();
            }
        },

        closeModal() {
            document.getElementById('modal-overlay').classList.remove('open');
        },

        // Renders
        renderError(message) {
            const main = document.getElementById('main-content');
            // If main is not yet available (very early error), try app container
            const container = main || document.getElementById('app') || document.body;

            container.innerHTML = `
            <div style="height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 2rem;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
                <h2 style="margin-bottom: 1rem; color: #d9534f;">Lo sentimos, hubo un problema</h2>
                <p style="color: #666; margin-bottom: 2rem; max-width: 400px;">${message}</p>
                <button onclick="window.location.reload()" class="btn-primary">Intentar nuevamente</button>
            </div>
         `;
        },

        renderHome() {

            const main = document.getElementById('main-content');
            main.innerHTML = `
            <section class="container hero">
                <div class="hero-content">
                    <h1 class="hero-title">Descubre tu mejor versión</h1>
                    <p class="hero-subtitle">Experiencias de bienestar y estética diseñadas exclusivamente para ti. Relájate, renueva y resplandece.</p>
                    <button onclick="turnoApp.navigate('services')" class="btn-secondary">Ver Tratamientos</button>
                </div>
                <!-- Hero Image -->
                <img src="assets/hero_bg.png" alt="Spa Relax" class="hero-image">
            </section>

            <section class="section">
                <div class="container">
                    <div class="section-header">
                        <h2 class="section-title">Nuestros Servicios Destacados</h2>
                        <p>Tratamientos personalizados para cada necesidad</p>
                    </div>
                    <div class="services-grid" id="featured-services">
                        <!-- Services injected here -->
                    </div>
                    
                    <!-- ENH-01: Infinite Scroll Loader Container (auto-injected) -->


                    <div class="text-center" style="margin-top: 2rem;">
                         <button onclick="turnoApp.navigate('services')" class="btn-secondary">Ver todo el catálogo completo</button>
                    </div>
                </div>
            </section>
        `;

            // Inject initial services
            this.renderFeaturedServices(state.visibleServicesCount);
        },

        renderFeaturedServices(limit) {
            const grid = document.getElementById('featured-services');
            grid.innerHTML = ''; // Clear current
            state.services.slice(0, limit).forEach(service => {
                grid.innerHTML += this.createServiceCard(service);
            });

            // Button visibility logic - Infinite Scroll Sentinel
            // Ensure sentinel exists
            let sentinel = document.getElementById('sentinel');
            if (!sentinel) {
                sentinel = document.createElement('div');
                sentinel.id = 'sentinel';
                sentinel.className = 'loader-container';
                sentinel.innerHTML = '<div class="loader"></div>';
                grid.parentElement.appendChild(sentinel);
            }

            // Hide loader if all loaded
            if (limit >= state.services.length) {
                sentinel.style.display = 'none';
            } else {
                sentinel.style.display = 'flex';
                // Re-observe if needed
                if (this.observer) this.observer.observe(sentinel);
            }

            // Setup Observer if not exists
            if (!this.observer) {
                const options = {
                    root: null,
                    rootMargin: '100px',
                    threshold: 0.1
                };

                this.observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting && !state.isLoading && state.visibleServicesCount < state.services.length) {
                            turnoApp.loadMoreServices();
                        }
                    });
                }, options);

                this.observer.observe(sentinel);
            }

            this.updateIcons();
        },

        loadMoreServices() {
            if (state.isLoading) return;
            state.isLoading = true;

            // Simulate network delay for UX
            setTimeout(() => {
                state.visibleServicesCount += 4;
                this.renderFeaturedServices(state.visibleServicesCount);
                state.isLoading = false;
            }, 800);
        },

        renderServices(category = 'Todas') {
            const main = document.getElementById('main-content');

            const categories = ['Todas', ...new Set(state.services.map(s => s.category))];

            const filteredServices = category === 'Todas' ? state.services : state.services.filter(s => s.category === category);

            main.innerHTML = `
            <section class="section">
                <div class="container">
                    <div class="section-header">
                        <h2 class="section-title">Menú de Tratamientos</h2>
                        <p>Selecciona el tratamiento ideal para ti</p>
                    </div>

                    <!-- ENH-15: Tabs -->
                    <div class="filters">
                        ${categories.map(cat => `
                            <button onclick="turnoApp.renderServices('${cat}')" class="tab-btn ${cat === category ? 'active' : ''}">${cat}</button>
                        `).join('')}
                    </div>

                    <div class="services-grid">
                        ${filteredServices.map(s => this.createServiceCard(s)).join('')}
                    </div>
                    <div class="text-center" style="margin-top: 4rem;">
                        <a href="https://wa.me/1234567890" target="_blank" class="btn-primary" style="text-decoration: none; display: inline-flex; align-items: center; gap: 0.5rem;">
                            <i data-lucide="message-circle"></i>Hacé tu consulta por WhatsApp
                        </a>
                    </div>
                </div>
            </section>
        `;
            this.updateIcons();
        },

        renderServiceDetail(id) {
            const service = state.services.find(s => s.id === id);
            if (!service) return this.navigate('services');

            const main = document.getElementById('main-content');
            main.innerHTML = `
            <div class="detail-header">
                <div class="container text-center">
                    <button onclick="turnoApp.navigate('services')" class="btn-secondary" style="background:transparent; border-color:white; color: white; margin-bottom: 2rem;">← Volver a tratamientos</button>
                    <h1 style="font-size: 3rem; margin-bottom: 1rem;">${service.name}</h1>
                    <p style="font-size: 1.25rem; opacity: 0.9;">${service.intro || service.description}</p>
                </div>
            </div>
            
            <section class="container" style="padding: 0 1.5rem 4rem;">
                <div style="display: grid; grid-template-columns: 3fr 2fr; gap: 4rem; margin-top: -3rem; position: relative; z-index: 2;">
                    <!-- Left Column: Details -->
                    <div style="background: white; padding: 2.5rem; border-radius: var(--radius-lg); box-shadow: var(--shadow-lg);">
                        <h2 style="margin-bottom: 1.5rem; color: var(--primary-dark);">Sobre el Tratamiento</h2>
                        <p style="color: #444; line-height: 1.7; margin-bottom: 2rem; font-size: 1.05rem;">
                            ${service.longDescription || service.description}
                        </p>

                         ${service.products ? `
                        <div style="margin-bottom: 2.5rem;">
                            <h3 style="font-size: 1.1rem; color: var(--primary); margin-bottom: 1rem; font-weight: 600;">Productos y Tecnología</h3>
                            <div style="display: flex; flex-wrap: wrap; gap: 0.75rem;">
                                ${service.products.map(p => `
                                    <span style="background: #f0f9ff; color: #0369a1; padding: 6px 14px; border-radius: 20px; font-size: 0.9rem; border: 1px solid #e0f2fe;">${p}</span>
                                `).join('')}
                            </div>
                        </div>
                        ` : ''}

                        <h3 style="font-size: 1.1rem; color: var(--primary); margin-bottom: 1rem; font-weight: 600;">Beneficios Clave</h3>
                        <ul class="benefit-list">
                            ${(service.benefits || []).map(b => `<li>${b}</li>`).join('')}
                        </ul>
                    </div>

                    <!-- Right Column: Card -->
                    <div>
                         <div style="background: white; padding: 2rem; border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); position: sticky; top: 2rem;">
                             <div style="background: #f8f8f8; height: 250px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem;">
                                <i data-lucide="${service.icon}" size="80" style="color: #ccc"></i>
                             </div>
                            
                            <div style="display: flex; justify-content: space-between; margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid #eee;">
                                <span style="color: #666;">Duración</span>
                                <strong style="color: var(--primary-dark);">${service.duration} mins</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 2rem;">
                                <span style="color: #666;">Precio Estimado</span>
                                <strong style="font-size: 1.25rem; color: var(--primary-dark);">${turnoApp.formatServicePrice(service)}</strong>
                            </div>
                            
                            <button onclick="turnoApp.startBooking(${service.id})" class="btn-primary" style="width: 100%; text-align: center; justify-content: center; padding: 1rem;">
                                Reservar Turno
                            </button>
                            <p style="text-align: center; margin-top: 1rem; font-size: 0.85rem; color: #888;">Reserva fácil y segura</p>
                        </div>
                    </div>
                </div>
            </section>
        `;
            this.updateIcons();
        },

        renderProfessionals() {
            const main = document.getElementById('main-content');
            main.innerHTML = `
            <section class="section">
                <div class="container">
                    <div class="section-header">
                        <h2 class="section-title">Nuestros Profesionales</h2>
                        <p>Conoce al equipo de expertos dedicado a tu bienestar</p>
                    </div>
                    <div class="services-grid">
                        ${state.professionals.map(p => `
                            <div class="service-card text-center" onclick="turnoApp.navigate('professional-profile', ${p.id})" style="cursor: pointer; transition: transform 0.2s;">
                                <div style="width: 100px; height: 100px; background: #eee; border-radius: 50%; margin: 0 auto 1.5rem; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                                    ${p.image
                    ? `<img src="${p.image}" alt="${p.name}" class="prof-img">`
                    : `<i data-lucide="user" size="48" style="color: #ccc;"></i>`
                }
                                </div>
                                <h3>${p.name}</h3>
                                <p style="color: var(--primary); font-weight: 500; margin-bottom: 0.5rem;">${p.specialty}</p>
                                <p style="color: #666; font-size: 0.9rem;">Especialista en ${p.serviceIds.map(id => state.services.find(s => s.id === id)?.name).join(', ')}</p>
                                <button class="btn-secondary" style="margin-top: 1rem; padding: 4px 12px; font-size: 0.9rem;">Ver Perfil</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </section>
        `;
        },

        renderProfessionalProfile(id) {
            const p = state.professionals.find(prof => prof.id == id);
            if (!p) return this.navigate('professionals');

            const main = document.getElementById('main-content');
            main.innerHTML = `
            <section class="section">
                <div class="container">
                    <button onclick="turnoApp.navigate('professionals')" class="btn-secondary" style="margin-bottom: 2rem;">← Volver</button>
                    
                    <div style="background: white; border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-md);">
                        <div style="background: linear-gradient(135deg, var(--primary-light), white); padding: 3rem 1.5rem; text-align: center;">
                            <div style="width: 120px; height: 120px; background: white; border-radius: 50%; margin: 0 auto 1.5rem; display: flex; align-items: center; justify-content: center; border: 4px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.05); overflow: hidden;">
                                ${p.image
                    ? `<img src="${p.image}" alt="${p.name}" class="prof-img">`
                    : `<i data-lucide="user" size="64" style="color: #ccc;"></i>`
                }
                            </div>
                            <h2 style="margin-bottom: 0.5rem;">${p.name}</h2>
                            <p style="color: var(--primary-dark); font-weight: 600;">${p.specialty}</p>
                        </div>
                        
                        <div style="padding: 2rem; max-width: 800px; margin: 0 auto;">
                            <h3 class="mb-4">Sobre mí</h3>
                            <p style="color: #666; line-height: 1.6; margin-bottom: 2rem;">
                                Profesional apasionada/o por la estética y el bienestar. Especialista en ${p.serviceIds.map(sid => state.services.find(s => s.id === sid)?.name).join(' y ')}. 
                                Con años de experiencia brindando tratamientos personalizados para realzar tu belleza natural.
                            </p>

                            <h3 class="mb-4">Tipos de turnos</h3>
                            <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 3rem;">
                                ${p.serviceIds.map(sid => {
                    const s = state.services.find(ser => ser.id === sid);
                    return `<span style="background: #f0fdf9; color: #047857; padding: 6px 16px; border-radius: 20px; border: 1px solid #ccfbf1;">${s.name}</span>`;
                }).join('')}
                            </div>

                            <div class="text-center">
                                <button onclick="turnoApp.startBooking(null, ${p.id})" class="btn-primary" style="padding: 1rem 3rem;">Solicitar Turno con ${p.name.split(' ')[0]}</button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        `;
            this.updateIcons();
        },

        createServiceCard(service) {
            return `
            <div class="service-card" onclick="turnoApp.viewService(${service.id})">
                <div class="service-icon">
                    <i data-lucide="${service.icon}"></i>
                </div>
                <h3>${service.name}</h3>
                <p style="color: #666; margin: 0.5rem 0;">${service.description}</p>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.5rem;">
                    <div>
                        <span style="display:block; font-size: 0.8rem; color: #999;">Precio estimado</span>
                        <span style="font-weight: 600; color: var(--primary-dark);">${turnoApp.formatServicePrice(service)}</span>
                    </div>
                    <span style="color: #999; font-size: 0.9rem;">${service.duration} min</span>
                </div>
                <div style="margin-top: 1rem; text-align: right;">
                    <span style="font-size: 0.9rem; color: var(--primary); font-weight: 600;">Ver Detalles →</span>
                </div>
            </div>
        `;
        },

        // ENH-Assignment: Helper for display
        getPatientProfessionalsDisplay(patient) {
            if (!patient.assignedProfessionalIds || patient.assignedProfessionalIds.length === 0) {
                return '<span style="color: #999; font-style: italic; font-size: 0.9rem;">Ninguno</span>';
            }
            const names = patient.assignedProfessionalIds
                .map(id => state.professionals.find(prof => prof.id === parseInt(id))?.name)
                .filter(Boolean);

            return names.join(', ');
        },

        openAssignProfessionalModal(email) {
            const patient = state.patients.find(p => p.email === email);
            if (!patient) return;

            const existingIds = new Set(patient.assignedProfessionalIds || []);

            const content = `
                <div class="modal-header">
                    <h3 style="margin-bottom: 0.5rem;">Asignar Profesionales</h3>
                    <p style="color: #666; margin-bottom: 1.5rem;">Paciente: <strong>${patient.name}</strong></p>
                </div>
                
                <form onsubmit="event.preventDefault(); turnoApp.savePatientAssignment('${email}')" id="assign-form">
                    <div style="max-height: 300px; overflow-y: auto; margin-bottom: 1.5rem; border: 1px solid #eee; border-radius: 8px; padding: 1rem;">
                        ${state.professionals.map(p => `
                            <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #f9f9f9;">
                                <label style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer; flex: 1;">
                                    <input type="checkbox" name="professional_id" value="${p.id}" ${existingIds.has(p.id) || existingIds.has(String(p.id)) ? 'checked' : ''} style="width: 18px; height: 18px;">
                                    <span>${p.name}</span>
                                </label>
                                <span style="font-size: 0.8rem; color: #999;">${p.specialty}</span>
                            </div>
                        `).join('')}
                    </div>

                    <div style="display: flex; gap: 1rem;">
                         <button type="button" onclick="turnoApp.closeModal()" class="btn-secondary" style="flex: 1;">Cancelar</button>
                        <button type="submit" class="btn-primary" style="flex: 1;">Guardar Asignaciones</button>
                    </div>
                </form>
            `;

            this.openModal(content);
        },

        savePatientAssignment(email) {
            const form = document.getElementById('assign-form');
            if (!form) return;

            const checkboxes = form.querySelectorAll('input[name="professional_id"]:checked');
            const selectedIds = Array.from(checkboxes).map(cb => parseInt(cb.value));

            const patientIndex = state.patients.findIndex(p => p.email === email);
            if (patientIndex !== -1) {
                state.patients[patientIndex].assignedProfessionalIds = selectedIds;
                localStorage.setItem('lumina_patients', JSON.stringify(state.patients));
                this.renderPatients(); // Re-render list
                this.showNotification('Asignaciones actualizadas correctamente');
            }
            this.closeModal();
        },

        renderBooking() {
            const main = document.getElementById('main-content');
            const defaultService = state.services.find(s => s.id === this.selectedService)?.id || "";

            main.innerHTML = `
            <section class="section">
                <div class="container">
                    <button onclick="window.history.back()" class="btn-secondary" style="margin-bottom: 1rem;">← Volver</button>
                    <div class="booking-container">
                        <h2 class="text-center mb-4">${state.rescheduleId ? 'Reagendar Turno' : 'Reserva tu Turno'}</h2>
                        ${state.rescheduleId ? '<div style="background: #e0f2fe; color: #0369a1; padding: 1rem; border-radius: 8px; margin-bottom: 2rem; text-align: center;">Estás reagendando un turno existente. El anterior será cancelado automáticamente al confirmar.</div>' : ''}
                        <form id="booking-form" onsubmit="turnoApp.handleBookingSubmit(event)">
                            <div class="form-group">
                                <label class="form-label">Servicio</label>
                                <select class="form-select" name="service" id="service-select" required onchange="turnoApp.filterProfessionals()">
                                    <option value="">Selecciona un servicio</option>
                                    ${state.services
                    .filter(s => state.professionals.some(p => p.serviceIds.includes(s.id)))
                    .map(s =>
                        `<option value="${s.id}" ${s.id === defaultService ? 'selected' : ''}>${s.name} - ${turnoApp.formatServicePrice(s)}</option>`
                    ).join('')}
                                </select>
                            </div>

                            <div class="form-group">
                                <label class="form-label">Profesional</label>
                                <select class="form-select" name="professional" id="professional-select" required onchange="turnoApp.generateTimeSlots()" disabled>
                                    <option value="">Primero selecciona un servicio</option>
                                </select>
                            </div>

                            <div class="form-group">
                                <label class="form-label">Fecha</label>
                                <input type="date" class="form-input" name="date" required min="${new Date().toISOString().split('T')[0]}" onchange="turnoApp.generateTimeSlots()">
                            </div>

                            <div class="form-group">
                                <label class="form-label">Horario</label>
                                <div class="time-slots" id="time-slots">
                                    <!-- Time slots generate by JS -->
                                </div>
                                <input type="hidden" name="time" id="selected-time" required>
                            </div>

                            <div class="form-group">
                                <label class="form-label">Nombre Completo</label>
                                <input type="text" class="form-input" name="name" required placeholder="Tu nombre">
                            </div>

                            <div class="form-group">
                                <label class="form-label">Email</label>
                                <input type="email" class="form-input" name="email" required placeholder="tu@email.com">
                            </div>

                            <button type="submit" class="btn-primary" style="width: 100%">Confirmar Reserva</button>
                        </form>
                    </div>
                </div>
            </section >
    `;

            if (state.currentUser) {
                const nameInput = document.querySelector('input[name="name"]');
                const emailInput = document.querySelector('input[name="email"]');
                if (nameInput) nameInput.value = state.currentUser.name;
                if (emailInput) {
                    emailInput.value = state.currentUser.email;
                    emailInput.readOnly = true; // Lock email to ensure it matches account
                    emailInput.style.backgroundColor = "#f0f0f0";
                }
            }

            this.filterProfessionals();

            // Pre-select professional if set
            if (this.selectedProfessional) {
                const profSelect = document.getElementById('professional-select');
                // Check if the professional is in the options (it might not be if service doesn't match, but logic should handle it)
                if (profSelect.querySelector(`option[value="${this.selectedProfessional}"]`)) {
                    profSelect.value = this.selectedProfessional;
                }
                // Clear it after using so it doesn't persist improperly across navigations if not intended
                this.selectedProfessional = null;
            }
        },

        filterProfessionals() {
            const serviceId = document.getElementById('service-select').value;
            const profSelect = document.getElementById('professional-select');

            profSelect.innerHTML = '<option value="">Selecciona un profesional</option>';
            profSelect.disabled = !serviceId;

            if (!serviceId) return;

            const availableProfs = state.professionals.filter(p => p.serviceIds.includes(parseInt(serviceId)));

            if (availableProfs.length === 0) {
                profSelect.innerHTML = '<option value="">No hay profesionales disponibles</option>';
                profSelect.disabled = true;
                return;
            }

            profSelect.innerHTML += availableProfs.map(p =>
                `<option value="${p.id}">${p.name} (${p.specialty})</option>`
            ).join('');

            // Reset slots
            document.getElementById('time-slots').innerHTML = '';
        },

        generateTimeSlots() {
            const slotsContainer = document.getElementById('time-slots');

            const serviceSelect = document.getElementById('service-select');
            const profSelect = document.getElementById('professional-select');
            const dateInput = document.querySelector('input[name="date"]');

            const serviceId = serviceSelect ? serviceSelect.value : null;
            const profId = profSelect ? profSelect.value : null;
            const date = dateInput ? dateInput.value : null;

            if (!serviceId || !profId || !date) {
                slotsContainer.innerHTML = '<p class="text-center" style="grid-column: 1/-1; color: #666;">Completa Servicio, Profesional y Fecha para ver horarios.</p>';
                return;
            }

            const service = state.services.find(s => s.id == serviceId);
            const duration = service.duration;
            const times = [];

            const prof = state.professionals.find(p => p.id == profId);

            if (prof && this.isDateFullyBlocked(prof.availability?.blockouts, date)) {
                slotsContainer.innerHTML = '<p class="text-center" style="grid-column: 1/-1; color: #d9534f; font-weight:500;">El profesional se encuentra de vacaciones o no atiende este día completo.</p>';
                return;
            }

            const dayName = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
            const schedule = prof?.availability?.schedule?.[dayName] || [];

            if (schedule.length === 0) {
                slotsContainer.innerHTML = '<p class="text-center" style="grid-column: 1/-1; color: #d9534f; font-weight:500;">El profesional no atiende los días ' + new Date(date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long' }) + 's.</p>';
                return;
            }

            let minMin = 24 * 60;
            let maxMin = 0;
            schedule.forEach(r => {
                const [s, e] = r.split('-');
                minMin = Math.min(minMin, this.timeToMinutes(s));
                maxMin = Math.max(maxMin, this.timeToMinutes(e));
            });

            // Get existing bookings for this professional on this date
            const existingBookings = state.bookings.filter(b =>
                b.professionalId == profId && b.date === date && b.status !== 'Cancelado'
            );

            // ENH-17: Filter past times
            const now = new Date();
            const [y, m, d] = date.split('-').map(Number);
            const selectedDate = new Date(y, m - 1, d);
            const isToday = selectedDate.getDate() === now.getDate() &&
                selectedDate.getMonth() === now.getMonth() &&
                selectedDate.getFullYear() === now.getFullYear();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();

            // Generate slots bounding minMin to maxMin
            for (let currentTime = minMin; currentTime + duration <= maxMin; currentTime += duration) {
                const slotEnd = currentTime + duration;

                // Check if slot falls ENTIRELY within ANY of the defined schedule ranges
                const isWithinWorkingHours = schedule.some(range => {
                    const [sTime, eTime] = range.split('-');
                    const sMin = this.timeToMinutes(sTime);
                    const eMin = this.timeToMinutes(eTime);
                    return currentTime >= sMin && slotEnd <= eMin;
                });

                if (!isWithinWorkingHours) continue;

                // Skip past times if today
                if (isToday && currentTime <= currentMinutes) continue;

                // Validate Blockouts (Specific Hours)
                const isBlocked = this.isTimeBlocked(prof.availability?.blockouts, date, currentTime, duration);

                // Booking overlap check
                const isBooked = existingBookings.some(b => {
                    const bStart = this.timeToMinutes(b.time);
                    const bService = state.services.find(s => s.name === b.serviceName);
                    const bDuration = bService ? bService.duration : 60;
                    const bEnd = bStart + bDuration;
                    return (currentTime < bEnd && slotEnd > bStart);
                });

                const hours = Math.floor(currentTime / 60);
                const minutes = currentTime % 60;
                const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} `;

                times.push({
                    time: timeStr,
                    available: !isBooked && !isBlocked
                });
            }

            if (times.length === 0) {
                slotsContainer.innerHTML = '<p class="text-center" style="grid-column: 1/-1; color: #d9534f;">No hay turnos disponibles para esta fecha.</p>';
            } else {
                slotsContainer.innerHTML = times.map(slot => `
                <div class="time-slot ${slot.available ? '' : 'disabled'}" 
                     ${slot.available ? `onclick="turnoApp.selectTime(this, '${slot.time.trim()}')"` : ''}>
                    ${slot.time}
                </div>
            `).join('');
            }
        },

        selectTime(el, time) {
            document.querySelectorAll('.time-slot').forEach(d => d.classList.remove('selected'));
            el.classList.add('selected');
            document.getElementById('selected-time').value = time;
        },



        async fetchBookings() {
            const { data, error } = await supabase
                .from('bookings')
                .select(`
                *,
                services (name),
                professionals (name)
            `)
                .order('date', { ascending: true });

            if (data) {
                state.bookings = data.map(b => ({
                    ...b,
                    serviceName: b.services ? b.services.name : 'Servicio',
                    professionalName: b.professionals ? b.professionals.name : 'Profesional',
                    serviceId: b.service_id,
                    professionalId: b.professional_id,
                    clientName: b.patient_name,
                    clientEmail: b.client_email
                }));
            }
        },

        async handleBookingSubmit(e) {
            e.preventDefault();
            const formData = new FormData(e.target);

            if (!formData.get('time')) {
                this.showNotification('Por favor selecciona un horario.');
                return;
            }

            const serviceId = parseInt(formData.get('service'));
            const professionalId = parseInt(formData.get('professional'));
            const date = formData.get('date');
            const time = formData.get('time').trim();
            const clientName = formData.get('name');
            const clientEmail = formData.get('email');

            // Prepare object for Supabase
            const newBooking = {
                date,
                time,
                service_id: serviceId,
                professional_id: professionalId,
                client_id: state.currentUser ? state.currentUser.id : null,
                patient_name: clientName,
                client_email: clientEmail,
                status: 'confirmed'
            };

            const { data, error } = await supabase.from('bookings').insert([newBooking]).select();

            if (error) {
                alert('Error al reservar: ' + error.message);
                return;
            }

            this.showNotification('Turno reservado con éxito!');

            await this.fetchBookings();

            // Match existing confirmation logic
            // We construct a purely local object for the modal display
            const displayBooking = {
                ...newBooking,
                serviceName: state.services.find(s => s.id === serviceId).name,
                professionalName: state.professionals.find(p => p.id === professionalId).name
            };
            this.showEmailModal(displayBooking);

            if (state.currentUser) {
                // Optional: navigate away or stay
                this.navigate('my-bookings');
            }
        },

        showEmailModal(booking) {
            const content = `
            <div style="display: flex; justify-content: center; gap: 1rem; margin-bottom: 2rem; border-bottom: 1px solid #eee;">
                <button onclick="turnoApp.switchChannel('email')" id="btn-email" class="tab-btn active" style="padding-bottom: 0.5rem;">Email</button>
                <button onclick="turnoApp.switchChannel('whatsapp')" id="btn-whatsapp" class="tab-btn" style="padding-bottom: 0.5rem;">WhatsApp</button>
                <button onclick="turnoApp.switchChannel('sms')" id="btn-sms" class="tab-btn" style="padding-bottom: 0.5rem;">SMS</button>
            </div>
            
            <div id="content-email" class="channel-content">
                <div style="text-align: center; margin-bottom: 2rem;">
                    <div style="background: #e6fffa; width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem;">
                        <i data-lucide="mail-check" style="color: #047857; width: 32px; height: 32px;"></i>
                    </div>
                    <h2>¡Reserva Confirmada!</h2>
                    <p style="color: #666;">Hemos enviado un correo a <strong>${booking.clientEmail}</strong></p>
                </div>
                <div style="background: #f8fafc; padding: 1.5rem; border-radius: 8px; border: 1px solid #e2e8f0; text-align: left; font-family: monospace; font-size: 0.9rem; color: #475569; position: relative;">
                    <p style="margin-bottom: 0.5rem;"><strong>Asunto:</strong> Confirmación de Turno - ElevaMed</p>
                    <p>Hola ${booking.clientName}, tu turno para <strong>${booking.serviceName}</strong> con ${booking.professionalName} el ${booking.date} a las ${booking.time} está confirmado.</p>
                </div>
            </div>

            <div id="content-whatsapp" class="channel-content" style="display:none;">
                <div style="text-align: center; margin-bottom: 2rem;">
                     <div style="background: #e5ffeb; width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem;">
                        <i data-lucide="message-circle" style="color: #25D366; width: 32px; height: 32px;"></i>
                    </div>
                    <h2>Enviar Confirmación</h2>
                    <p style="color: #666;">Envía los detalles por WhatsApp</p>
                </div>
                <div style="background: #e5ffeb; padding: 1rem; border-radius: 8px; text-align: left; margin-bottom: 1rem; color: #1f2937;">
                    <p>Hola *${booking.clientName}*! 👋<br>Te confirmamos tu turno en *ElevaMed*:<br>✨ Tratamiento: ${booking.serviceName}<br>📅 Fecha: ${booking.date}<br>⏰ Hora: ${booking.time}<br>📍 Te esperamos!</p>
                </div>
                <a href="https://wa.me/?text=Hola ${encodeURIComponent(booking.clientName)}! Te confirmamos tu turno: ${booking.serviceName} el ${booking.date} a las ${booking.time}." target="_blank" class="btn-primary" style="background: #25D366; border-color: #25D366; width: 100%; display: block; text-align: center; text-decoration: none;">Abrir WhatsApp</a>
            </div>

             <div id="content-sms" class="channel-content" style="display:none;">
                <div style="text-align: center; margin-bottom: 2rem;">
                     <div style="background: #f3f4f6; width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem;">
                        <i data-lucide="smartphone" style="color: #4b5563; width: 32px; height: 32px;"></i>
                    </div>
                     <h2>Enviar SMS</h2>
                </div>
                <div style="background: #f3f4f6; padding: 1rem; border-radius: 8px; text-align: left; margin-bottom: 1rem; font-family: monospace;">
                    <p>ElevaMed: Turno confirmado para ${booking.serviceName} el ${booking.date} ${booking.time}.</p>
                </div>
                <button onclick="turnoApp.showNotification('SMS enviado (simulado)')" class="btn-primary" style="width: 100%; background: #4b5563; border-color: #4b5563;">Simular Envío SMS</button>
            </div>

            <button onclick="turnoApp.closeModal(); turnoApp.navigate('home')" class="btn-secondary" style="width: 100%; margin-top: 1rem;">Cerrar</button>
        `;

            this.openModal(content);
            if (window.lucide) lucide.createIcons();
        },

        switchChannel(channel) {
            document.querySelectorAll('.channel-content').forEach(el => el.style.display = 'none');
            document.getElementById(`content-${channel}`).style.display = 'block';
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.getElementById(`btn-${channel}`).classList.add('active');
        },

        getPatientProfessionalsDisplay(p) {
            if (!p.assignedProfessionalIds || p.assignedProfessionalIds.length === 0) {
                return '<span style="color:#94a3b8; font-style:italic;">Sin asignar</span>';
            }
            const names = p.assignedProfessionalIds.map(id => {
                const prof = state.professionals.find(pr => pr.id === id);
                return prof ? prof.name.split(' ')[0] : 'Desconocido';
            }).join(', ');
            return names;
        },

        openAssignProfessionalModal(email) {
            const p = state.patients.find(pt => pt.email === email);
            if (!p) return;

            const content = `
                <div class="modal-header">
                    <h3>Asignar Profesionales a ${p.name}</h3>
                </div>
                <form onsubmit="turnoApp.savePatientProfessionals(event, '${email}')">
                    <div style="max-height: 200px; overflow-y: auto; border: 1px solid #e2e8f0; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                        ${state.professionals.map(prof => `
                            <label style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; cursor: pointer;">
                                <input type="checkbox" name="assign_prof" value="${prof.id}" ${p.assignedProfessionalIds && p.assignedProfessionalIds.includes(prof.id) ? 'checked' : ''}>
                                <span>${prof.name} <small style="color:#999">(${prof.specialty})</small></span>
                            </label>
                        `).join('')}
                    </div>
                    <div style="text-align: right;">
                        <button type="button" onclick="turnoApp.closeModal()" class="btn-secondary" style="margin-right: 0.5rem;">Cancelar</button>
                        <button type="submit" class="btn-primary">Guardar Asignación</button>
                    </div>
                </form>
            `;
            this.openModal(content);
        },

        savePatientProfessionals(e, email) {
            e.preventDefault();
            const p = state.patients.find(pt => pt.email === email);
            if (!p) return;

            const form = e.target;
            const checked = Array.from(form.querySelectorAll('input[name="assign_prof"]:checked')).map(cb => parseInt(cb.value));

            p.assignedProfessionalIds = checked;
            localStorage.setItem('lumina_patients', JSON.stringify(state.patients));

            this.closeModal();
            this.showNotification('Asignación de profesionales actualizada');
            this.renderPatients();
        },

        // ENH-26/27: Patient Management
        renderPatients() {
            const main = document.getElementById('main-content');
            const user = state.currentUser;

            // Filter patients based on role
            let visiblePatients = [];
            if (user.role === 'admin') {
                visiblePatients = state.patients;
            } else if (user.role === 'professional') {
                // Get emails of clients who have booked with this professional
                const myClientEmails = new Set(
                    state.bookings
                        .filter(b => parseInt(b.professionalId) === user.id)
                        .map(b => b.clientEmail)
                );
                visiblePatients = state.patients.filter(p => myClientEmails.has(p.email));
            }

            main.innerHTML = `
            <section class="section">
                <div class="container">
                    <div class="section-header">
                        <h2>Gestión de Pacientes</h2>
                        <p>${user.role === 'professional' ? 'Pacientes atendidos por ti' : 'Listado maestro de pacientes'}</p>
                    </div>
                    
                    <div class="mb-4" style="display: flex; gap: 1rem; max-width: 600px; margin: 0 auto 1.5rem;">
                        <input type="text" placeholder="Buscar por nombre, email o teléfono..." class="form-input" style="flex: 1;" onkeyup="turnoApp.filterPatients(this.value)">
                        ${user.role === 'professional' || user.role === 'admin' ?
                    `<button onclick="turnoApp.showCreatePatientModal()" class="btn-primary" style="white-space: nowrap;">+ Nuevo Paciente</button>`
                    : ''}
                    </div>

                    <div style="overflow-x: auto;">
                        <table class="admin-table">
                            <thead>
                                    <th>Nombre</th>
                                    <th>MRN</th>
                                    <th>Email</th>
                                    <th>Teléfono</th>
                                    <th>Última Visita</th>
                                    <th>Total Turnos</th>
                                    <th>Profesionales</th>
                                    <th>Acción</th>
                                </tr>
                            </thead>
                            <tbody id="patients-table-body">
                                ${visiblePatients.length ? visiblePatients.map(p => `
                                        <td>${p.name}</td>
                                        <td style="font-family: monospace; font-size: 0.85rem; color: #4f46e5;">${p.mrn || '-'}</td>
                                        <td>${p.email}</td>
                                        <td>${p.phone}</td>
                                        <td>${p.lastVisit}</td>
                                        <td>${p.totalVisits}</td>
                                        <td>
                                            ${this.getPatientProfessionalsDisplay(p)}
                                            ${user.role === 'admin' ?
                            `<button onclick="turnoApp.openAssignProfessionalModal('${p.email}')" style="background:none; border:none; cursor:pointer;" title="Asignar Profesional">✏️</button>`
                            : ''}
                                        </td>
                                        <td>
                                            <button onclick="turnoApp.navigate('patient-profile', '${p.email}')" style="background: var(--primary); color: white; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer;">Ver Perfil</button>
                                        </td>
                                    </tr>
                                `).join('') : '<tr><td colspan="7" class="text-center">No se encontraron pacientes.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        `;

            // Store for filtering
            this.currentPatientList = visiblePatients;
        },

        updateServiceFilter(key, value) {
            if (key === 'clear') {
                state.serviceFilters = { status: '', category: '', professionalId: '' };
            } else {
                state.serviceFilters[key] = value;
            }
            this.renderServicesManagement();
        },

        // ENH-Services: Service Management
        renderServicesManagement() {
            const main = document.getElementById('main-content');
            let services = state.services;
            const { status, category, professionalId } = state.serviceFilters;

            // 1. Apply Filters
            if (status) {
                if (status === 'active') services = services.filter(s => s.active);
                else if (status === 'inactive') services = services.filter(s => !s.active);
            }
            if (category) {
                services = services.filter(s => s.category === category);
            }
            if (professionalId) {
                const prof = state.professionals.find(p => p.id === parseInt(professionalId));
                if (prof) {
                    services = services.filter(s => prof.serviceIds.includes(s.id));
                }
            }

            // 2. Prepare Dropdown Data
            const categories = [...new Set(state.services.map(s => s.category))];

            main.innerHTML = `
    <section class="section">
        <div class="container">
            <div class="section-header">
                <h2>Gestión de Servicios</h2>
                <p>Configura los servicios ofrecidos y profesionales asignados</p>
            </div>
            
            <div class="mb-4" style="display: flex; justify-content: space-between; align-items: center; max-width: 100%; margin: 0 auto 1.5rem;">
                <button onclick="turnoApp.navigate('admin')" class="btn-secondary">← Volver al Panel</button>
                <div style="flex-grow: 1;"></div>
                <button onclick="turnoApp.openServiceModal()" class="btn-primary">+ Nuevo Servicio</button>
            </div>

            <!-- Service Filters -->
            <div class="filters-bar">
                <div class="filter-group">
                    <label class="filter-label">Estado</label>
                    <select class="filter-select" onchange="turnoApp.updateServiceFilter('status', this.value)">
                        <option value="">Todos</option>
                        <option value="active" ${status === 'active' ? 'selected' : ''}>Activos</option>
                        <option value="inactive" ${status === 'inactive' ? 'selected' : ''}>Inactivos</option>
                    </select>
                </div>
                 <div class="filter-group">
                    <label class="filter-label">Categoría</label>
                    <select class="filter-select" onchange="turnoApp.updateServiceFilter('category', this.value)">
                        <option value="">Todas</option>
                        ${categories.map(cat => `<option value="${cat}" ${category === cat ? 'selected' : ''}>${cat}</option>`).join('')}
                    </select>
                </div>
                <div class="filter-group">
                    <label class="filter-label">Profesional Asignado</label>
                    <select class="filter-select" onchange="turnoApp.updateServiceFilter('professionalId', this.value)">
                        <option value="">Todos</option>
                        ${state.professionals.map(p => `<option value="${p.id}" ${professionalId == p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
                    </select>
                </div>
                 <button onclick="turnoApp.updateServiceFilter('clear')" class="btn-filter-clear">
                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> Limpiar
                </button>
            </div>

            <div style="overflow-x: auto;">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Nombre</th>
                            <th>Categoría</th>
                            <th>Duración</th>
                            <th>Precio</th>
                            <th>Estado</th>
                            <th>Profesionales</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${services.length > 0 ? services.map(s => {
                // Find professionals who have this service ID
                const assignedProfs = state.professionals.filter(p => p.serviceIds.includes(s.id));
                const profNames = assignedProfs.map(p => p.name).join(', ') || '<span style="color:#999;font-style:italic">Ninguno</span>';

                return `
                            <tr style="${!s.active ? 'opacity: 0.6; background: #f9f9f9;' : ''}">
                                <td><strong>${s.name}</strong></td>
                                <td>${s.category}</td>
                                <td>${s.duration} min</td>
                                <td>${turnoApp.formatServicePrice(s)}</td>
                                <td>
                                    <span class="status-badge ${s.active ? 'completado' : 'cancelado'}">
                                        ${s.active ? 'Activo' : 'Inactivo'}
                                    </span>
                                </td>
                                <td>${profNames}</td>
                                <td>
                                    <button onclick="turnoApp.openServiceModal(${s.id})" style="background:none; border:none; cursor:pointer; font-size:1.1rem; margin-right:0.5rem;" title="Editar">✏️</button>
                                    <button onclick="turnoApp.deleteService(${s.id})" style="background:none; border:none; cursor:pointer; font-size:1.1rem; color: #dc3545;" title="${s.active ? 'Desactivar' : 'Reactivar'}">${s.active ? '🗑️' : '♻️'}</button>
                                </td>
                            </tr>
                        `}).join('') : `<tr><td colspan="7" class="text-center">No se encontraron servicios con estos filtros.</td></tr>`}
                    </tbody>
                </table>
            </div>
        </div>
    </section>
    `;
        },

        // ENH-Professionals: Professional Management
        renderProfessionalsManagement() {
            const main = document.getElementById('main-content');
            const professionals = state.professionals;

            main.innerHTML = `
    <section class="section">
        <div class="container">
            <div class="section-header">
                <h2>Gestión de Profesionales</h2>
                <p>Administra el equipo, sus perfiles y disponibilidad horaria</p>
            </div>
            
            <div class="mb-4" style="display: flex; justify-content: space-between; align-items: center; max-width: 100%; margin: 0 auto 1.5rem;">
                <button onclick="turnoApp.navigate('admin')" class="btn-secondary">← Volver al Panel</button>
                <div style="flex-grow: 1;"></div>
                <button onclick="turnoApp.showProfessionalModal()" class="btn-primary">+ Nuevo Profesional</button>
            </div>

            <div style="overflow-x: auto;">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Nombre</th>
                            <th>Especialidad</th>
                            <th>Servicios Asignados</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${professionals.map(p => {
                // Calculate services count
                const serviceCount = p.serviceIds ? p.serviceIds.length : 0;
                const isActive = p.active !== false; // Default to true if undefined for compatibility

                return `
                            <tr style="${!isActive ? 'opacity: 0.6; background: #f9f9f9;' : ''}">
                                <td>
                                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                                        <div style="width: 32px; height: 32px; background: #eee; border-radius: 50%; overflow: hidden;">
                                            ${p.image ? `<img src="${p.image}" style="width:100%;height:100%;object-fit:cover;">` : `<i data-lucide="user" style="padding:6px; color:#ccc;"></i>`}
                                        </div>
                                        <strong>${p.name}</strong>
                                    </div>
                                </td>
                                <td>${p.specialty || '-'}</td>
                                <td>${serviceCount} servicios</td>
                                <td>
                                    <span class="status-badge ${isActive ? 'completado' : 'cancelado'}">
                                        ${isActive ? 'Activo' : 'Inactivo'}
                                    </span>
                                </td>
                                <td>
                                    <button onclick="turnoApp.showProfessionalModal(${p.id})" style="background:none; border:none; cursor:pointer; font-size:1.1rem; margin-right:0.5rem;" title="Editar">✏️</button>
                                    <button onclick="turnoApp.toggleProfessionalStatus(${p.id})" style="background:none; border:none; cursor:pointer; font-size:1.1rem;" title="${isActive ? 'Desactivar' : 'Reactivar'}">${isActive ? '🛑' : '✅'}</button>
                                </td>
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    </section>
    `;
            this.updateIcons();
        },

        showProfessionalModal(profId = null) {
            const prof = profId ? state.professionals.find(p => p.id === profId) : null;
            const isEdit = !!prof;

            // Mock default availability if missing
            const availability = (prof && prof.availability) ? prof.availability : {
                schedule: {
                    'Mon': ['09:00-18:00'],
                    'Tue': ['09:00-18:00'],
                    'Wed': ['09:00-18:00'],
                    'Thu': ['09:00-18:00'],
                    'Fri': ['09:00-18:00']
                },
                blockouts: []
            };

            const content = `
                <div class="modal-header">
                    <h3>${isEdit ? 'Editar Profesional' : 'Nuevo Profesional'}</h3>
                </div>
                
                <!-- Tabs -->
                <div style="display: flex; gap: 1rem; border-bottom: 2px solid #e2e8f0; margin-bottom: 1.5rem;">
                    <button class="tab-btn active" onclick="turnoApp.switchModalTab('general')" id="tab-btn-general">General</button>
                    <button class="tab-btn" onclick="turnoApp.switchModalTab('availability')" id="tab-btn-availability">Disponibilidad</button>
                </div>

                <form onsubmit="turnoApp.saveProfessional(event, ${profId})">
                    <!-- General Tab -->
                    <div id="modal-tab-general" class="modal-tab-content">
                        <div class="form-group">
                            <label class="form-label">Nombre Completo</label>
                            <input type="text" name="name" class="form-input" required value="${prof ? prof.name : ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Especialidad</label>
                            <input type="text" name="specialty" class="form-input" value="${prof ? prof.specialty : ''}" placeholder="Ej: Facialista, Masajista...">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Biografía</label>
                            <textarea name="bio" class="form-input" rows="3">${prof && prof.bio ? prof.bio : ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label class="form-label">URL Imagen de Perfil</label>
                            <input type="text" name="image" class="form-input" value="${prof ? prof.image : ''}" placeholder="https://...">
                        </div>
                        
                        ${!isEdit ? `
                        <h4 style="margin-bottom: 0.5rem; margin-top: 1.5rem; border-bottom: 1px solid #eee; padding-bottom: 0.5rem;">Credenciales de Acceso</h4>
                        <div class="form-group">
                            <label class="form-label">Email de Acceso (Requerido)</label>
                            <input type="email" name="userEmail" class="form-input" required value="">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Contraseña</label>
                            <div style="display: flex; gap: 0.5rem;">
                                <input type="text" name="userPassword" id="prof-password" class="form-input" required value="">
                                <button type="button" class="btn-secondary" onclick="document.getElementById('prof-password').value = Math.random().toString(36).slice(-8);">Generar</button>
                            </div>
                            <p style="font-size: 0.8rem; color: #666; margin-top: 0.25rem;">Copia esta contraseña y el email para enviárselos al profesional.</p>
                        </div>
                        ` : ''}
                        
                        <div class="form-group">
                            <label class="form-label">Servicios Asignados</label>
                            <div style="max-height: 150px; overflow-y: auto; border: 1px solid #e2e8f0; padding: 0.5rem; border-radius: 6px;">
                                ${state.services.map(s => `
                                    <label style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                                        <input type="checkbox" name="services" value="${s.id}" ${prof && prof.serviceIds && prof.serviceIds.includes(s.id) ? 'checked' : ''}>
                                        <span style="font-size: 0.9rem;">${s.name} (${s.category})</span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                    </div>

                    <!-- Availability Tab -->
                    <div id="modal-tab-availability" class="modal-tab-content" style="display: none;">
                        <p style="font-size: 0.9rem; color: #666; margin-bottom: 1rem;">Usa los interruptores para activar los días que atiendes y configura tus turnos (el segundo turno es opcional).</p>
                        
                        ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
                const dayMap = { 'Mon': 'Lunes', 'Tue': 'Martes', 'Wed': 'Miércoles', 'Thu': 'Jueves', 'Fri': 'Viernes', 'Sat': 'Sábado', 'Sun': 'Domingo' };
                const ranges = availability.schedule[day] || [];
                const isActive = ranges.length > 0;

                let start1 = '', end1 = '', start2 = '', end2 = '';
                if (ranges[0]) {
                    [start1, end1] = ranges[0].split('-');
                }
                if (ranges[1]) {
                    [start2, end2] = ranges[1].split('-');
                }

                return `
                    <div style="margin-bottom: 1rem; padding: 1rem; border: 1px solid #e2e8f0; border-radius: 8px; background: ${isActive ? '#fff' : '#f8fafc'}; transition: all 0.2s;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: ${isActive ? '1rem' : '0'};">
                            <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: 600; cursor: pointer; color: ${isActive ? 'var(--primary-dark)' : '#94a3b8'};">
                                <input type="checkbox" name="active_${day}" ${isActive ? 'checked' : ''} onchange="
                                    const c = document.getElementById('config_${day}');
                                    c.style.display = this.checked ? 'block' : 'none';
                                    this.parentElement.style.color = this.checked ? 'var(--primary-dark)' : '#94a3b8';
                                    this.parentElement.parentElement.parentElement.style.background = this.checked ? '#fff' : '#f8fafc';
                                    this.parentElement.nextElementSibling.innerText = this.checked ? 'Atiende' : 'Descanso';
                                    this.parentElement.nextElementSibling.style.color = this.checked ? 'var(--primary)' : '#94a3b8';
                                    if(this.checked && !document.querySelector('[name=start1_${day}]').value) {
                                        document.querySelector('[name=start1_${day}]').value = '09:00';
                                        document.querySelector('[name=end1_${day}]').value = '18:00';
                                    }
                                " style="width: 18px; height: 18px;">
                                ${dayMap[day]}
                            </label>
                            <span style="font-size:0.8rem; font-weight: 500; color: ${isActive ? 'var(--primary)' : '#94a3b8'};">${isActive ? 'Atiende' : 'Descanso'}</span>
                        </div>
                        
                        <div id="config_${day}" style="display: ${isActive ? 'block' : 'none'};">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 0.5rem;">
                                <div>
                                    <label style="font-size: 0.8rem; color:#666; display:block; margin-bottom:0.25rem;">Turno 1 (Principal)</label>
                                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                                        <input type="time" name="start1_${day}" class="form-input" value="${start1}">
                                        <span style="color:#999">-</span>
                                        <input type="time" name="end1_${day}" class="form-input" value="${end1}">
                                    </div>
                                </div>
                                <div>
                                    <label style="font-size: 0.8rem; color:#666; display:block; margin-bottom:0.25rem;">Turno 2 (Opcional)</label>
                                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                                        <input type="time" name="start2_${day}" class="form-input" value="${start2}">
                                        <span style="color:#999">-</span>
                                        <input type="time" name="end2_${day}" class="form-input" value="${end2}">
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}

                        <hr style="margin: 1.5rem 0; border: 0; border-top: 1px solid #e2e8f0;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem;">
                            <h4 style="margin: 0;">Reglas de Excepción y Vacaciones</h4>
                            <button type="button" class="btn-secondary" onclick="turnoApp.addBlockoutRow()" style="padding: 0.25rem 0.5rem; font-size:0.8rem;">+ Agregar Regla</button>
                        </div>
                        <div id="blockouts-container" style="display:flex; flex-direction:column; gap:0.5rem;">
                            ${(Array.isArray(availability.blockouts) ? availability.blockouts : []).map((b, i) => {
                // Soporte para formato legacy de strings
                if (typeof b === 'string') {
                    b = { type: 'full_day', start: b };
                }
                return turnoApp.generateBlockoutRowHTML(b, i);
            }).join('')}
                        </div>
                    </div>

                    <div style="margin-top: 1.5rem; text-align: right;">
                        <button type="button" onclick="turnoApp.closeModal()" class="btn-secondary" style="margin-right: 0.5rem;">Cancelar</button>
                        <button type="submit" class="btn-primary">Guardar Profesional</button>
                    </div>
                </form>
            `;
            this.openModal(content);
        },

        timeToMinutes(timeStr) {
            if (!timeStr) return 0;
            const [h, m] = timeStr.split(':').map(Number);
            return h * 60 + (m || 0);
        },

        isDateFullyBlocked(blockouts, dateStr) {
            if (!blockouts || !Array.isArray(blockouts)) return false;
            return blockouts.some(b => {
                if (typeof b === 'string') return b === dateStr;
                if (b.type === 'full_day' && b.start === dateStr) return true;
                if (b.type === 'date_range' && dateStr >= b.start && dateStr <= b.end) return true;
                return false;
            });
        },

        isTimeBlocked(blockouts, dateStr, slotStartMin, slotDuration) {
            if (!blockouts || !Array.isArray(blockouts)) return false;
            const slotEndMin = slotStartMin + slotDuration;

            return blockouts.some(b => {
                if (b.type === 'time_slot' && b.start === dateStr) {
                    const bStartMin = this.timeToMinutes(b.startTime);
                    const bEndMin = this.timeToMinutes(b.endTime);
                    return slotStartMin < bEndMin && slotEndMin > bStartMin;
                }
                return false;
            });
        },

        switchModalTab(tabId) {
            document.querySelectorAll('.modal-tab-content').forEach(el => el.style.display = 'none');
            document.getElementById(`modal-tab-${tabId}`).style.display = 'block';
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.getElementById(`tab-btn-${tabId}`).classList.add('active');
        },

        generateBlockoutRowHTML(b = { type: 'full_day', start: '' }, index = Date.now()) {
            return `
            <div class="blockout-row" style="border: 1px solid #e2e8f0; border-radius:6px; padding: 0.75rem; background:#f8fafc; position:relative;" data-id="${index}">
                <button type="button" onclick="this.closest('.blockout-row').remove()" style="position:absolute; right: 0.5rem; top: 0.5rem; background:none; border:none; color:#be123c; cursor:pointer;" title="Eliminar regla">✖</button>
                <div style="display:grid; grid-template-columns: 1fr 2fr; gap:0.5rem; align-items:end;">
                    <div>
                        <label style="font-size:0.75rem; color:#666;">Tipo de Regla</label>
                        <select name="bo_type_${index}" class="form-select" onchange="const row = this.closest('.blockout-row'); row.querySelector('.bo-date').style.display = this.value === 'date_range' ? 'none' : 'block'; row.querySelector('.bo-range').style.display = this.value === 'date_range' ? 'flex' : 'none'; row.querySelector('.bo-time').style.display = this.value === 'time_slot' ? 'flex' : 'none';" style="padding: 0.4rem;">
                            <option value="full_day" ${b.type === 'full_day' ? 'selected' : ''}>Día Completo</option>
                            <option value="date_range" ${b.type === 'date_range' ? 'selected' : ''}>Rango de Días</option>
                            <option value="time_slot" ${b.type === 'time_slot' ? 'selected' : ''}>Horario Específico</option>
                        </select>
                    </div>
                    <div class="bo-date" style="display: ${b.type !== 'date_range' ? 'block' : 'none'};">
                        <label style="font-size:0.75rem; color:#666;">Fecha</label>
                        <input type="date" name="bo_date_${index}" class="form-input" style="padding: 0.4rem;" value="${b.type !== 'date_range' ? b.start : ''}">
                    </div>
                    <div class="bo-range" style="display: ${b.type === 'date_range' ? 'flex' : 'none'}; gap:0.5rem;">
                        <div style="flex:1;">
                            <label style="font-size:0.75rem; color:#666;">Desde</label>
                            <input type="date" name="bo_start_${index}" class="form-input" style="padding: 0.4rem;" value="${b.type === 'date_range' ? b.start : ''}">
                        </div>
                        <div style="flex:1;">
                            <label style="font-size:0.75rem; color:#666;">Hasta</label>
                            <input type="date" name="bo_end_${index}" class="form-input" style="padding: 0.4rem;" value="${b.type === 'date_range' ? b.end : ''}">
                        </div>
                    </div>
                </div>
                <div class="bo-time" style="display: ${b.type === 'time_slot' ? 'flex' : 'none'}; gap:0.5rem; margin-top:0.5rem;">
                     <div>
                        <label style="font-size:0.75rem; color:#666;">Hora Inicio</label>
                        <input type="time" name="bo_startTime_${index}" class="form-input" style="padding: 0.4rem;" value="${b.startTime || ''}">
                     </div>
                     <div>
                        <label style="font-size:0.75rem; color:#666;">Hora Fin</label>
                        <input type="time" name="bo_endTime_${index}" class="form-input" style="padding: 0.4rem;" value="${b.endTime || ''}">
                     </div>
                </div>
            </div>
            `;
        },

        addBlockoutRow() {
            const container = document.getElementById('blockouts-container');
            if (container) {
                container.insertAdjacentHTML('beforeend', this.generateBlockoutRowHTML({ type: 'full_day', start: '' }, Date.now() + Math.floor(Math.random() * 1000)));
            }
        },

        toggleProfessionalStatus(id) {
            const p = state.professionals.find(prof => prof.id === id);
            if (p) {
                p.active = p.active !== false ? false : true;
                this.renderProfessionalsManagement();
                // Persist logic would go here
            }
        },

        async saveProfessional(e, id) {
            e.preventDefault();
            const form = e.target;
            const formData = new FormData(form);

            // Gather General Data
            const name = formData.get('name');
            const specialty = formData.get('specialty');
            const bio = formData.get('bio');
            const image = formData.get('image');

            // Gather Services
            const serviceCheckboxes = form.querySelectorAll('input[name="services"]:checked');
            const serviceIds = Array.from(serviceCheckboxes).map(cb => parseInt(cb.value));

            // Gather Schedule
            const schedule = {};
            ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(day => {
                const isActive = formData.get(`active_${day}`);
                if (isActive) {
                    const s1 = formData.get(`start1_${day}`);
                    const e1 = formData.get(`end1_${day}`);
                    const s2 = formData.get(`start2_${day}`);
                    const e2 = formData.get(`end2_${day}`);

                    const dayRanges = [];
                    if (s1 && e1) dayRanges.push(`${s1}-${e1}`);
                    if (s2 && e2) dayRanges.push(`${s2}-${e2}`);

                    if (dayRanges.length > 0) {
                        schedule[day] = dayRanges;
                    }
                }
            });

            // Gather Blockouts Advanced
            const blockouts = [];
            const blockoutRows = form.querySelectorAll('.blockout-row');
            blockoutRows.forEach(row => {
                const idAttr = row.getAttribute('data-id');
                const type = formData.get(`bo_type_${idAttr}`);
                const b = { type };

                if (type === 'full_day') {
                    b.start = formData.get(`bo_date_${idAttr}`);
                    if (!b.start) return; // Skip empty
                } else if (type === 'time_slot') {
                    b.start = formData.get(`bo_date_${idAttr}`);
                    b.startTime = formData.get(`bo_startTime_${idAttr}`);
                    b.endTime = formData.get(`bo_endTime_${idAttr}`);
                    if (!b.start || !b.startTime || !b.endTime) return;
                } else if (type === 'date_range') {
                    b.start = formData.get(`bo_start_${idAttr}`);
                    b.end = formData.get(`bo_end_${idAttr}`);
                    if (!b.start || !b.end) return;
                }
                blockouts.push(b);
            });
            if (id) {
                // Update
                const p = state.professionals.find(prof => prof.id === id);
                p.name = name;
                p.specialty = specialty;
                p.bio = bio;
                p.image = image;
                p.serviceIds = serviceIds;
                p.availability = { schedule, blockouts };

                this.closeModal();
                this.showNotification('Profesional actualizado correctamente');
                this.renderProfessionalsManagement();
            } else {
                // Create New Professional AND User
                const userEmail = formData.get('userEmail');
                const userPassword = formData.get('userPassword');

                if (!userEmail || !userPassword) {
                    alert('El email y la contraseña son obligatorios.');
                    return;
                }

                // 1. Create User via non-persisting dummy client (so Admin is not logged out)
                const dummyClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
                    auth: { persistSession: false, autoRefreshToken: false }
                });

                const { data: authData, error: authError } = await dummyClient.auth.signUp({
                    email: userEmail,
                    password: userPassword,
                    options: { data: { role: 'professional', name: name } }
                });

                if (authError) {
                    alert('Error creando cuenta en el servidor: ' + authError.message);
                    return;
                }

                const newUserId = authData.user?.id;

                if (newUserId) {
                    // 2. Insert into 'profiles' globally
                    await supabase.from('profiles').upsert({
                        id: newUserId,
                        email: userEmail,
                        name: name,
                        role: 'professional'
                    });
                }

                // 3. Push to state (local memory for this prototype, although ideally it's pushed to a professionals table too)
                const newId = Date.now();
                state.professionals.push({
                    id: newId,
                    user_id: newUserId, // Link to auth
                    name,
                    specialty,
                    bio,
                    image,
                    serviceIds,
                    active: true,
                    availability: { schedule, blockouts }
                });

                this.closeModal();
                this.renderProfessionalsManagement();

                // Show crucial alert with the credentials!
                alert(`¡Profesional Creado Exitosamente!\n\nPor favor envía estos datos al profesional:\n\nEmail: ${userEmail}\nContraseña: ${userPassword}`);
            }
        },

        openServiceModal(serviceId = null) {
            const service = serviceId ? state.services.find(s => s.id === serviceId) : null;
            const title = service ? 'Editar Servicio' : 'Nuevo Servicio';

            // Determine assigned professionals for this service
            const assignedProfIds = new Set();
            if (serviceId) {
                state.professionals.forEach(p => {
                    if (p.serviceIds.includes(serviceId)) {
                        assignedProfIds.add(p.id);
                    }
                });
            }

            const icons = [
                { val: 'sparkles', label: 'Brillos (Estética/Facial)' },
                { val: 'sun', label: 'Sol (Relax/Masajes)' },
                { val: 'moon', label: 'Luna (Noche/Relax)' },
                { val: 'heart', label: 'Corazón (Cuidado/Uñas)' },
                { val: 'star', label: 'Estrella (Destacado)' },
                { val: 'zap', label: 'Rayo (Rápido/Láser)' },
                { val: 'droplets', label: 'Gotas (Hidratación/Spa)' },
                { val: 'feather', label: 'Pluma (Suave/Sensitivo)' }
            ];

            const content = `
        <div class="modal-header">
            <h3>${title}</h3>
        </div>
        <form onsubmit="event.preventDefault(); turnoApp.saveService(${serviceId})" id="service-form" style="display: grid; gap: 1rem;">
            <div class="form-group">
                <label class="form-label">Nombre del Servicio</label>
                <input type="text" name="name" class="form-input" value="${service ? service.name : ''}" required>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                    <label class="form-label">Categoría</label>
                    <select name="category" class="form-select" required>
                        <option value="Facial" ${service && service.category === 'Facial' ? 'selected' : ''}>Facial</option>
                        <option value="Corporal" ${service && service.category === 'Corporal' ? 'selected' : ''}>Corporal</option>
                        <option value="Manos y Pies" ${service && service.category === 'Manos y Pies' ? 'selected' : ''}>Manos y Pies</option>
                        <option value="Otros" ${service && service.category === 'Otros' ? 'selected' : ''}>Otros</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Duración (min)</label>
                    <input type="number" name="duration" class="form-input" value="${service ? service.duration : '30'}" required min="5" step="5">
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                    <label class="form-label">Tipo de Precio</label>
                    <select class="form-select" name="priceType" onchange="document.getElementById('fixed-price-div').style.display = this.value === 'fixed' ? 'block' : 'none'; document.getElementById('var-price-div').style.display = this.value === 'variable' ? 'block' : 'none';">
                        <option value="fixed" ${!service || service.priceType !== 'variable' ? 'selected' : ''}>Fijo</option>
                        <option value="variable" ${service && service.priceType === 'variable' ? 'selected' : ''}>Variable / Estimado</option>
                    </select>
                </div>
                 <div class="form-group">
                    <label class="form-label">Icono (Lucide)</label>
                    <select name="icon" class="form-select">
                        ${icons.map(i => `<option value="${i.val}" ${service && service.icon === i.val ? 'selected' : ''}>${i.label}</option>`).join('')}
                    </select>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr; gap: 1rem; margin-bottom: 0.5rem;">
                <div id="fixed-price-div" style="display: ${!service || service.priceType !== 'variable' ? 'block' : 'none'};" class="form-group">
                    <label class="form-label">Precio ($) (Referencia Base)</label>
                    <input type="number" name="price" class="form-input" value="${service ? service.price : '0'}" min="0">
                </div>
                <div id="var-price-div" style="display: ${service && service.priceType === 'variable' ? 'block' : 'none'};" class="form-group">
                    <label class="form-label">Detalle de Precio Variable (Ej: "Desde $15.000", "$10.000 - $20.000")</label>
                    <input type="text" name="priceRange" class="form-input" value="${service && service.priceRange ? service.priceRange : ''}">
                </div>
            </div>

            <div class="form-group">
                <label class="form-label">Descripción Corta</label>
                <textarea name="description" class="form-input" rows="2">${service ? service.description : ''}</textarea>
            </div>

            <div class="form-group">
                <label class="form-label" style="margin-bottom: 0.5rem; display: block;">Profesionales Asignados</label>
                <div style="border: 1px solid #eee; border-radius: 8px; padding: 1rem; max-height: 150px; overflow-y: auto;">
                    ${state.professionals.map(p => `
                        <label style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; cursor: pointer;">
                            <input type="checkbox" name="assigned_profs" value="${p.id}" ${assignedProfIds.has(p.id) ? 'checked' : ''}>
                            <span>${p.name} <small style="color:#999">(${p.specialty})</small></span>
                        </label>
                    `).join('')}
                </div>
            </div>

            <div class="form-group">
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                    <input type="checkbox" name="active" ${!service || service.active ? 'checked' : ''}>
                    <span>Servicio Activo (visible para reservas)</span>
                </label>
            </div>

            <button type="submit" class="btn-primary" style="width: 100%;">Guardar Servicio</button>
        </form>
    `;

            this.openModal(content);
        },

        saveService(serviceId) {
            const form = document.getElementById('service-form');
            if (!form) return;

            const formData = new FormData(form);
            const assignedProfIds = Array.from(form.querySelectorAll('input[name="assigned_profs"]:checked')).map(cb => parseInt(cb.value));

            const serviceData = {
                name: formData.get('name'),
                category: formData.get('category'),
                duration: parseInt(formData.get('duration')) || 30,
                price: parseFloat(formData.get('price')) || 0,
                priceType: formData.get('priceType') || 'fixed',
                priceRange: formData.get('priceRange') || '',
                icon: formData.get('icon'),
                description: formData.get('description'),
                active: formData.get('active') === 'on'
            };

            let newId = serviceId;

            if (serviceId) {
                // Update existing service
                const index = state.services.findIndex(s => s.id === serviceId);
                if (index !== -1) {
                    state.services[index] = { ...state.services[index], ...serviceData };
                }
            } else {
                // Create new service
                newId = state.services.length > 0 ? Math.max(...state.services.map(s => s.id)) + 1 : 1;
                state.services.push({
                    id: newId,
                    ...serviceData,
                    products: [], benefits: [] // Defaults
                });
            }

            // Handle Profile Assignments
            state.professionals.forEach(p => {
                const shouldHaveService = assignedProfIds.includes(p.id);
                const hasService = p.serviceIds.includes(newId);

                if (shouldHaveService && !hasService) {
                    p.serviceIds.push(newId);
                } else if (!shouldHaveService && hasService) {
                    p.serviceIds = p.serviceIds.filter(id => id !== newId);
                }
            });

            // Persist
            localStorage.setItem('lumina_services', JSON.stringify(state.services));
            localStorage.setItem('lumina_professionals', JSON.stringify(state.professionals));

            this.closeModal();
            this.renderServicesManagement();
            this.showNotification(serviceId ? 'Servicio actualizado' : 'Servicio creado');
        },

        deleteService(serviceId) {
            const service = state.services.find(s => s.id === serviceId);
            if (!service) return;

            // Soft delete toggle
            service.active = !service.active;

            localStorage.setItem('lumina_services', JSON.stringify(state.services));
            this.renderServicesManagement();
            this.showNotification(service.active ? 'Servicio reactivado' : 'Servicio desactivado');
        },

        filterPatients(query) {
            const tbody = document.getElementById('patients-table-body');
            const lowerQuery = query.toLowerCase();

            const filtered = this.currentPatientList.filter(p =>
                p.name.toLowerCase().includes(lowerQuery) ||
                p.email.toLowerCase().includes(lowerQuery) ||
                (p.phone && p.phone.includes(query)) ||
                (p.mrn && p.mrn.toLowerCase().includes(lowerQuery))
            );

            if (filtered.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center">No se encontraron pacientes que coincidan.</td></tr>';
                return;
            }

            tbody.innerHTML = filtered.map(p => `
            <tr>
                <td>${p.name}</td>
                <td style="font-family: monospace; font-size: 0.85rem; color: #4f46e5;">${p.mrn || '-'}</td>
                <td>${p.email}</td>
                <td>${p.phone}</td>
                <td>${p.lastVisit}</td>
                <td>${p.totalVisits}</td>
                <td>
                    ${this.getPatientProfessionalsDisplay(p)}
                    ${state.currentUser.role === 'admin' ?
                    `<button onclick="turnoApp.openAssignProfessionalModal('${p.email}')" style="background:none; border:none; cursor:pointer;" title="Asignar Profesional">✏️</button>`
                    : ''}
                </td>
                <td>
                    <button onclick="turnoApp.navigate('patient-profile', '${p.email}')" style="background: var(--primary); color: white; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer;">Ver Perfil</button>
                </td>
            </tr>
        `).join('');
        },

        showCreatePatientModal() {
            this.openModal(`
            <div style="text-align: left;">
                <h3 style="margin-bottom: 1.5rem;">Registrar Nuevo Paciente</h3>
                <form onsubmit="turnoApp.createPatient(event, this)">
                    <div class="form-group">
                        <label class="form-label">Nombre Completo</label>
                        <input type="text" name="name" class="form-input" required placeholder="Juan Pérez">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Email</label>
                        <input type="email" name="email" class="form-input" required placeholder="juan@ejemplo.com">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Teléfono</label>
                        <input type="tel" name="phone" class="form-input" required placeholder="11 1234 5678">
                    </div>
                    <div style="margin-top: 1.5rem; text-align: right;">
                        <button type="button" onclick="turnoApp.closeModal()" class="btn-secondary" style="margin-right: 0.5rem;">Cancelar</button>
                        <button type="submit" class="btn-primary">Crear Paciente</button>
                    </div>
                </form>
            </div>
        `);
        },

        async createPatient(e, form) {
            e.preventDefault();
            const name = form.name.value;
            const email = form.email.value;
            const phone = form.phone.value;

            if (state.patients.find(u => u.email === email)) {
                alert('Este email ya está localmente registrado en el sistema.');
                return;
            }

            // Create User via non-persisting dummy client (so Admin is not logged out)
            const dummyClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
                auth: { persistSession: false, autoRefreshToken: false }
            });

            const userPassword = Math.random().toString(36).slice(-8);

            const { data: authData, error: authError } = await dummyClient.auth.signUp({
                email: email,
                password: userPassword,
                options: { data: { role: 'patient', name: name } }
            });

            if (authError) {
                alert('Error creando cuenta en el servidor (Posible Email Duplicado): ' + authError.message);
                return;
            }

            const newUserId = authData.user?.id;

            let newPatientMrn = null;

            if (newUserId) {
                // Insert into 'profiles' globally and fetch the auto-generated MRN
                const { data, error: profileErr } = await supabase.from('profiles').upsert({
                    id: newUserId,
                    email: email,
                    name: name,
                    phone: phone,
                    role: 'patient'
                }).select('mrn').single();

                if (data && data.mrn) {
                    newPatientMrn = data.mrn;
                }
            }

            // 1. Create Patient Record Locally
            const newPatient = {
                id: newUserId,
                name,
                email,
                phone,
                mrn: newPatientMrn,
                lastVisit: '-',
                totalVisits: 0
            };
            state.patients.push(newPatient);
            localStorage.setItem('lumina_patients', JSON.stringify(state.patients));

            this.closeModal();
            this.showNotification('Paciente creado y guardado en base de datos');
            this.renderPatients(); // Refresh list

            // Show alert with credentials
            alert(`¡Paciente Creado Exitosamente!\n\nSe ha guardado en la base de datos central.\n\nEmail: ${email}\nContraseña temporal: ${userPassword}\n\nComunícale esta contraseña si desea ingresar a reservar turnos.`);
        },

        renderPatientProfile(email) {
            const p = state.patients.find(pt => pt.email === email);
            if (!p) return this.navigate('patients');

            const user = state.currentUser;
            let pBookings = state.bookings.filter(b => b.clientEmail === email);

            if (user.role === 'professional') {
                pBookings = pBookings.filter(b => parseInt(b.professionalId) === user.id);
            }

            // Sort desc
            pBookings.sort((a, b) => new Date(b.date + 'T' + b.time) - new Date(a.date + 'T' + a.time));

            const main = document.getElementById('main-content');
            main.innerHTML = `
            <section class="section">
                <div class="container">
                <div class="container">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                        <button onclick="turnoApp.navigate('patients')" class="btn-secondary">← Volver al Listado</button>
                        ${(user.role === 'professional' || user.role === 'admin') ?
                    `<button onclick="turnoApp.startBooking(null, null, '${p.email}')" class="btn-primary">Agendar Turno</button>`
                    : ''}
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 2rem;">
                        <!-- Profile Card -->
                        <div style="background: white; padding: 2rem; border-radius: var(--radius-lg); box-shadow: var(--shadow-md); height: fit-content;">
                            <div style="text-align: center; margin-bottom: 1.5rem;">
                                <div style="width: 80px; height: 80px; background: #eee; border-radius: 50%; margin: 0 auto 1rem; display: flex; align-items: center; justify-content: center;">
                                </div>
                                <h3 style="margin-bottom: 0.25rem;">${p.name}</h3>
                                <div style="font-family: monospace; background: #eef2ff; color: #4f46e5; padding: 0.2rem 0.5rem; border-radius: 4px; display: inline-block; margin-bottom: 0.5rem; font-size: 0.9rem;">
                                    ${p.mrn || 'Sin MRN'}
                                </div>
                                <p style="color: #666;">${p.email}</p>
                            </div>
                            <hr style="border: 0; border-top: 1px solid #eee; margin: 1.5rem 0;">
                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; font-weight: 500; margin-bottom: 0.25rem;">Email</label>
                                <div style="display: flex; gap: 0.5rem;">
                                    <input type="email" value="${p.email}" id="edit-email" class="form-input" style="padding: 0.5rem;">
                                </div>
                            </div>
                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; font-weight: 500; margin-bottom: 0.25rem;">Teléfono</label>
                                <div style="display: flex; gap: 0.5rem;">
                                    <input type="text" value="${p.phone || ''}" id="edit-phone" class="form-input" style="padding: 0.5rem;">
                                </div>
                            </div>
                            <button onclick="turnoApp.savePatientProfile('${p.id}')" class="btn-primary" style="width: 100%; margin-top: 1rem;">Guardar Cambios</button>
                            
                            <div style="margin-top: 2rem;">
                                <label style="display: block; font-weight: 500; margin-bottom: 0.25rem;">Visitas Totales</label>
                                <p>${p.totalVisits || 0}</p>
                            </div>
                            <div>
                                <label style="display: block; font-weight: 500; margin-bottom: 0.25rem;">Última Visita</label>
                                <p>${p.lastVisit || '-'}</p>
                            </div>
                        </div>

                        <!-- History -->
                        <div>
                             <h3 style="margin-bottom: 1rem;">Historial de Turnos</h3>
                             ${pBookings.length ? pBookings.map(b => `
                                <div class="dashboard-card">
                                    <div>
                                        <strong>${b.serviceName}</strong>
                                        <div style="font-size: 0.9rem; color: #666; margin-top: 0.25rem;">
                                            📅 ${b.date} ⏰ ${b.time}
                                            <br>
                                            👨‍⚕️ ${b.professionalName}
                                        </div>
                                    </div>
                                    <div>
                                        <span class="status-badge ${b.status.toLowerCase()}">
                                            ${b.status}
                                        </span>
                                    </div>
                                </div>
                             `).join('') : '<p>No hay historial disponible.</p>'}

                             <!-- Visit History (Financial) -->
                             <h3 style="margin: 2rem 0 1rem;">Historial de Visitas (Detalle)</h3>
                             ${(() => {
                    const bookingIds = new Set(pBookings.map(b => b.id));
                    const pVisits = state.visits.filter(v => bookingIds.has(v.bookingId));

                    if (!pVisits.length) return '<p style="color: #666;">No hay visitas registradas.</p>';

                    return `
                                    <div style="overflow-x: auto;">
                                        <table class="admin-table" style="font-size: 0.9rem;">
                                            <thead>
                                                <tr>
                                                    <th>Fecha</th>
                                                    <th>Tratamiento</th>
                                                    <th>Profesional</th>
                                                    <th>Monto</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${pVisits.sort((a, b) => new Date(b.date) - new Date(a.date)).map(v => {
                        const prof = state.professionals.find(p => p.id === parseInt(v.professionalId));
                        return `
                                                        <tr>
                                                            <td>${v.date}</td>
                                                            <td>${v.treatment || 'Servicio'}</td>
                                                            <td>${prof ? prof.name : 'Desconocido'}</td>
                                                            <td style="font-weight: bold;">$${v.price}</td>
                                                        </tr>
                                                     `;
                    }).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                `;
                })()}
                        </div>
                    </div>
                </div>
            </section>
        `;
            this.updateIcons();
        },

        async savePatientProfile(id) {
            const phone = document.getElementById('edit-phone').value;
            const email = document.getElementById('edit-email').value;

            const { error } = await supabase
                .from('profiles')
                .update({ phone: phone, email: email })
                .eq('id', id);

            if (error) {
                this.showNotification('Error al actualizar: ' + error.message);
            } else {
                this.showNotification('Perfil actualizado correctamente');
                // Refresh local data logic if needed, or re-fetch
                const p = state.patients.find(pt => pt.id === id);
                if (p) { p.phone = phone; p.email = email; }
            }
        },


        // ENH-24: Module Visits
        registerVisit(bookingId) {
            const booking = state.bookings.find(b => b.id === bookingId);
            if (!booking) return;

            const service = state.services.find(s => s.id === booking.serviceId) || {};
            const basePrice = booking.price || service.price || 0;
            const patient = state.patients.find(p => p.email === booking.clientEmail) || {};
            const currentUser = state.currentUser;

            const content = `
            <h3 class="mb-4">Completar Historia</h3>
            
            <div style="background: #f8fafc; padding: 1.5rem; border-radius: var(--radius-md); border: 1px solid #e2e8f0; margin-bottom: 1.5rem;">
                <h4 style="margin-top: 0; margin-bottom: 1rem; color: #334155; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.05em;">Detalles del Paciente</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; font-size: 0.9rem;">
                    <div>
                        <span style="color: #64748b; display: block; font-size: 0.8rem; margin-bottom: 0.2rem;">Nombre completo</span>
                        <strong>${booking.clientName}</strong>
                    </div>
                    <div>
                        <span style="color: #64748b; display: block; font-size: 0.8rem; margin-bottom: 0.2rem;">MRN</span>
                        <span style="font-family: monospace; background: #eef2ff; color: #4f46e5; padding: 0.15rem 0.4rem; border-radius: 3px; font-weight: 600;">${patient.mrn || 'N/A'}</span>
                    </div>
                    <div>
                        <span style="color: #64748b; display: block; font-size: 0.8rem; margin-bottom: 0.2rem;">Fecha del turno</span>
                        <strong>${booking.date} a las ${booking.time}</strong>
                    </div>
                    <div>
                        <span style="color: #64748b; display: block; font-size: 0.8rem; margin-bottom: 0.2rem;">Profesional a cargo</span>
                        <strong>${currentUser.name}</strong>
                    </div>
                    <div style="grid-column: span 2;">
                        <span style="color: #64748b; display: block; font-size: 0.8rem; margin-bottom: 0.2rem;">Servicio(s)</span>
                        <strong>${booking.serviceName}</strong>
                    </div>
                </div>
            </div>

            <form onsubmit="turnoApp.saveVisit(event, ${bookingId})">
                <div class="form-group">
                    <label class="form-label">Tratamiento Realizado</label>
                    <input type="text" name="treatment" class="form-input" value="${booking.serviceName}" required>
                </div>
                 <div class="form-group">
                    <label class="form-label">Unidades / Detalles Generales</label>
                    <input type="text" name="units" class="form-input" placeholder="Ej: 2 viales, 1 sesión...">
                </div>

                <hr style="border: 0; border-top: 1px solid #eee; margin: 1.5rem 0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h4 style="margin: 0;">Productos Utilizados</h4>
                    <button type="button" class="btn-primary" style="padding: 0.3rem 0.6rem; font-size: 0.85rem;" onclick="turnoApp.addVisitProductRow()">
                        <i data-lucide="plus" style="width: 14px; height: 14px; display: inline-block;"></i> Agregar producto
                    </button>
                </div>
                
                <div style="overflow-x: auto; margin-bottom: 1rem;">
                    <table class="admin-table" style="font-size: 0.85rem;" id="visit-products-table">
                        <thead>
                            <tr>
                                <th style="width: 25%;">Producto</th>
                                <th style="width: 25%;">Vial / Lote</th>
                                <th style="width: 15%;">Cantidad</th>
                                <th style="width: 15%;">Precio Unit.</th>
                                <th style="width: 15%;">Total Línea</th>
                                <th style="width: 5%;"></th>
                            </tr>
                        </thead>
                        <tbody id="visit-products-list">
                            <!-- JS injected rows -->
                        </tbody>
                    </table>
                </div>

                <hr style="border: 0; border-top: 1px solid #eee; margin: 1.5rem 0;">
                <h4 style="margin-bottom: 1rem;">Precios y Pago</h4>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group">
                        <label class="form-label">Subtotal ($)</label>
                        <input type="number" id="visit-subtotal" name="subtotal" class="form-input" value="${basePrice}" readonly style="background-color: #f8fafc; cursor: not-allowed;">
                        <small style="color: #666; font-size: 0.75rem;">(Incluye servicio y productos)</small>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Descuento ($)</label>
                        <input type="number" id="visit-discount" name="discount" class="form-input" value="0" min="0" oninput="turnoApp.calculateVisitTotal()">
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label" style="font-weight: 600;">Total a Cobrar ($)</label>
                    <input type="number" id="visit-total" name="price" class="form-input" value="${basePrice}" readonly style="background-color: #f8fafc; font-weight: bold; font-size: 1.1rem;">
                </div>

                <div class="form-group">
                    <label class="form-label">Forma de Pago</label>
                    <select name="paymentMethod" class="form-select" required>
                        <option value="Efectivo" ${booking.paymentMethod === 'Efectivo' ? 'selected' : ''}>Efectivo</option>
                        <option value="Tarjeta" ${booking.paymentMethod === 'Tarjeta' ? 'selected' : ''}>Tarjeta</option>
                        <option value="Transferencia" ${booking.paymentMethod === 'Transferencia' ? 'selected' : ''}>Transferencia</option>
                        <option value="A confirmar" disabled style="display:none" ${!['Efectivo','Tarjeta','Transferencia'].includes(booking.paymentMethod) ? 'selected' : ''}>A confirmar</option>
                    </select>
                </div>

                <div class="form-group" style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
                    <input type="checkbox" name="cardOnFile" id="cardOnFile" style="width: 16px; height: 16px;">
                    <label for="cardOnFile" class="form-label" style="margin-bottom: 0; cursor: pointer;">Card on file (Solo referencia)</label>
                </div>

                <div class="form-group">
                    <label class="form-label">Notas de pago</label>
                    <textarea name="paymentNotes" class="form-input" rows="2" placeholder="Opcional..."></textarea>
                </div>

                <hr style="border: 0; border-top: 1px solid #eee; margin: 1.5rem 0;">

                <div class="form-group">
                    <label class="form-label">Notas Internas</label>
                    <textarea name="notes" class="form-input" rows="3"></textarea>
                </div>
                <button type="submit" class="btn-primary" style="width: 100%;">Guardar Visita</button>
            </form>
        `;
            this.openModal(content);
            // Auto add the first row
            this.addVisitProductRow();
        },

        // Add a new row to the products table
        addVisitProductRow() {
            const list = document.getElementById('visit-products-list');
            if (!list) return;
            const uniqueId = Date.now() + Math.floor(Math.random() * 1000);

            const activeProducts = state.inventoryProducts;
            const productOptions = activeProducts.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

            const tr = document.createElement('tr');
            tr.id = `visit-product-row-${uniqueId}`;
            tr.innerHTML = `
                <td>
                    <select class="form-select visit-product-select" data-row-id="${uniqueId}" style="padding: 0.25rem;" onchange="turnoApp.onVisitProductChange(${uniqueId})" required>
                        <option value="">Seleccione...</option>
                        ${productOptions}
                    </select>
                </td>
                <td>
                    <select class="form-select visit-vial-select" data-row-id="${uniqueId}" style="padding: 0.25rem; display: none;" onchange="turnoApp.onVisitProductQuantityChange(${uniqueId})" required>
                    </select>
                    <span class="visit-no-vial-text" data-row-id="${uniqueId}" style="color:#666; font-size:0.8rem; display:none;">N/A (Skincare)</span>
                </td>
                <td>
                    <input type="number" class="form-input visit-units-input" data-row-id="${uniqueId}" style="padding: 0.25rem;" min="1" value="1" step="any" required oninput="turnoApp.onVisitProductQuantityChange(${uniqueId})">
                    <div class="visit-units-warning" data-row-id="${uniqueId}" style="color:#ef4444; font-size:0.7rem; display:none;">Unidades insuficientes</div>
                </td>
                <td>
                    <input type="number" class="form-input visit-price-input" data-row-id="${uniqueId}" style="padding: 0.25rem;" min="0" value="0" step="1" required oninput="turnoApp.onVisitProductQuantityChange(${uniqueId})">
                </td>
                <td>
                    <input type="number" class="form-input visit-linetotal-input" data-row-id="${uniqueId}" style="padding: 0.25rem; background-color: #f8fafc; font-weight: bold;" value="0" readonly>
                </td>
                <td style="text-align: center;">
                    <button type="button" class="btn-icon" style="color:#ef4444;" onclick="turnoApp.removeVisitProductRow(${uniqueId})">
                        <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                    </button>
                </td>
            `;
            list.appendChild(tr);
            this.updateIcons();
        },

        removeVisitProductRow(rowId) {
            const tr = document.getElementById(`visit-product-row-${rowId}`);
            if (tr) tr.remove();
            this.calculateVisitTotal();
        },

        onVisitProductChange(rowId) {
            const productSelect = document.querySelector(`.visit-product-select[data-row-id="${rowId}"]`);
            const vialSelect = document.querySelector(`.visit-vial-select[data-row-id="${rowId}"]`);
            const noVialText = document.querySelector(`.visit-no-vial-text[data-row-id="${rowId}"]`);
            const priceInput = document.querySelector(`.visit-price-input[data-row-id="${rowId}"]`);
            const unitsInput = document.querySelector(`.visit-units-input[data-row-id="${rowId}"]`);
            
            const productId = parseInt(productSelect.value);
            const product = state.inventoryProducts.find(p => p.id === productId);

            if (!product) {
                vialSelect.style.display = 'none';
                noVialText.style.display = 'none';
                priceInput.value = 0;
                this.onVisitProductQuantityChange(rowId);
                return;
            }

            // Auto-fill price
            priceInput.value = product.sale_price !== null ? product.sale_price : (product.price || 0);

            if (product.unit_type === 'vial') {
                // It is injectable -> show vials
                noVialText.style.display = 'none';
                vialSelect.style.display = 'block';
                // Always make vial required for injectables
                vialSelect.required = true;

                const vials = state.inventoryVials.filter(v => v.product_id === productId && v.available_quantity > 0 && v.active !== false);
                if (vials.length > 0) {
                    vialSelect.innerHTML = `<option value="">Seleccione Vial</option>` + vials.map(v => 
                        `<option value="${v.id}" data-max="${v.available_quantity}">Cód: ${v.asset_code} — Lote: ${v.lot || '-'} — Vence: ${v.expiration_date || '-'} — ${v.available_quantity} ud disp</option>`
                    ).join('');
                } else {
                    vialSelect.innerHTML = `<option value="">(Sin Viales Activos)</option>`;
                }
            } else {
                // Skincare or other -> hide vials
                vialSelect.style.display = 'none';
                vialSelect.innerHTML = '';
                vialSelect.required = false;
                noVialText.style.display = 'block';
            }

            this.onVisitProductQuantityChange(rowId);
        },

        onVisitProductQuantityChange(rowId) {
            const unitsInput = document.querySelector(`.visit-units-input[data-row-id="${rowId}"]`);
            const priceInput = document.querySelector(`.visit-price-input[data-row-id="${rowId}"]`);
            const lineTotalInput = document.querySelector(`.visit-linetotal-input[data-row-id="${rowId}"]`);
            const vialSelect = document.querySelector(`.visit-vial-select[data-row-id="${rowId}"]`);
            const warningEl = document.querySelector(`.visit-units-warning[data-row-id="${rowId}"]`);
            
            const units = parseFloat(unitsInput.value) || 0;
            const price = parseFloat(priceInput.value) || 0;
            lineTotalInput.value = (units * price).toFixed(2);

            // Validation for vials
            if (vialSelect.style.display !== 'none' && vialSelect.selectedIndex > 0) {
                const opt = vialSelect.options[vialSelect.selectedIndex];
                const max = parseFloat(opt.getAttribute('data-max')) || 0;
                if (units > max) {
                    warningEl.innerText = `Insuficiente. Disponibles: ${max}`;
                    warningEl.style.display = 'block';
                    unitsInput.setCustomValidity("Unidades insuficientes");
                } else {
                    warningEl.style.display = 'none';
                    unitsInput.setCustomValidity("");
                }
            } else {
                warningEl.style.display = 'none';
                unitsInput.setCustomValidity("");
            }

            this.calculateVisitTotal();
        },

        calculateVisitTotal() {
            // Include service base price
            const form = document.getElementById('modal-content').querySelector('form');
            // Hacky way to retrieve basePrice we injected in the initial value of subtotal, 
            // but we can just parse the original readonly subtotal... wait, no. We need to store basePrice.
            // Let's use a hidden attribute or just recompute it here if we attach bookingId somehow.
            // But we can just query the DOM inputs for all line totals and add them to a single baseServicePrice.
            
            let baseServicePrice = parseFloat(document.getElementById('visit-subtotal').getAttribute('data-base-price')) || 0;
            // Since we didn't add data-base-price earlier, we'll do it by storing the original value of subtotal.
            if (!document.getElementById('visit-subtotal').hasAttribute('data-base-price')) {
                 document.getElementById('visit-subtotal').setAttribute('data-base-price', document.getElementById('visit-subtotal').value);
            }
            baseServicePrice = parseFloat(document.getElementById('visit-subtotal').getAttribute('data-base-price')) || 0;

            let productsSubtotal = 0;
            document.querySelectorAll('.visit-linetotal-input').forEach(input => {
                productsSubtotal += (parseFloat(input.value) || 0);
            });

            const subtotal = baseServicePrice + productsSubtotal;
            document.getElementById('visit-subtotal').value = subtotal;

            const discount = parseFloat(document.getElementById('visit-discount').value) || 0;
            const total = subtotal - discount;
            document.getElementById('visit-total').value = total > 0 ? total : 0;
        },

        saveVisit(e, bookingId) {
            e.preventDefault();
            const formData = new FormData(e.target);
            
            // Check if Products Validation passes
            const list = document.getElementById('visit-products-list');
            const rows = document.querySelectorAll('.visit-product-select');
            
            // At least one product required? The prompt says: "At least one product row required before saving"
            if (rows.length === 0) {
                alert("Debes agregar al menos un producto a la historia clínica (Services & Products Section).");
                return;
            }

            let consumedProducts = [];
            let validationFailed = false;

            document.querySelectorAll('.visit-product-select').forEach(sel => {
                const rowId = sel.getAttribute('data-row-id');
                const productId = parseInt(sel.value);
                const vialSelect = document.querySelector(`.visit-vial-select[data-row-id="${rowId}"]`);
                const unitsInput = document.querySelector(`.visit-units-input[data-row-id="${rowId}"]`);
                const priceInput = document.querySelector(`.visit-price-input[data-row-id="${rowId}"]`);
                const lineTotalInput = document.querySelector(`.visit-linetotal-input[data-row-id="${rowId}"]`);

                if (!productId) { validationFailed = true; return; }

                let vialId = null;
                if (vialSelect.style.display !== 'none') {
                    vialId = parseInt(vialSelect.value);
                    if (!vialId) { validationFailed = true; return; }
                }
                const units = parseFloat(unitsInput.value);
                if (!units || units <= 0) { validationFailed = true; return; }

                if (unitsInput.validationMessage) { validationFailed = true; return; }

                // Gather item for audit
                consumedProducts.push({
                    productId,
                    productName: sel.options[sel.selectedIndex].text,
                    vialId,
                    vialAssetCode: vialId ? vialSelect.options[vialSelect.selectedIndex].text.split('—')[0].trim().replace('Cód: ', '') : null,
                    units,
                    pricePerUnit: parseFloat(priceInput.value),
                    lineTotal: parseFloat(lineTotalInput.value)
                });
            });

            if (validationFailed) {
                alert("Por favor complete toda la información requerida en la tabla de productos y verifique el stock.");
                return;
            }

            // Deduct stock immediately
            consumedProducts.forEach(consumo => {
                if (consumo.vialId) {
                    const vialIndex = state.inventoryVials.findIndex(v => v.id === consumo.vialId);
                    if (vialIndex > -1) {
                        state.inventoryVials[vialIndex].available_quantity -= consumo.units;
                    }
                } else {
                    // Skincare or normal products
                    const productIndex = state.inventoryProducts.findIndex(p => p.id === consumo.productId);
                    if (productIndex > -1 && state.inventoryProducts[productIndex].stock) {
                        state.inventoryProducts[productIndex].stock.available_quantity -= consumo.units;
                    }
                }
            });

            const visit = {
                id: Date.now(),
                bookingId: bookingId,
                date: new Date().toISOString().split('T')[0],
                professionalId: state.currentUser.id,
                treatment: formData.get('treatment'),
                units: formData.get('units'),
                price: parseFloat(formData.get('price')),
                subtotal: parseFloat(formData.get('subtotal')),
                discount: parseFloat(formData.get('discount')),
                paymentMethod: formData.get('paymentMethod'),
                cardOnFile: formData.get('cardOnFile') === 'on',
                paymentNotes: formData.get('paymentNotes'),
                notes: formData.get('notes'),
                consumedProducts: consumedProducts // Audit trail
            };

            state.visits.push(visit);
            localStorage.setItem('lumina_visits', JSON.stringify(state.visits));

            // Optional DB Stock Deductions would go here if we were executing real SQL inserts/updates.
            
            // Update booking status
            const booking = state.bookings.find(b => b.id === bookingId);
            if (booking) {
                booking.status = 'Completado';
                const newTotal = parseFloat(formData.get('price'));
                if (booking.price !== newTotal) {
                    booking.price = newTotal;
                    console.log("Monto actualizado al completar historia de visita");
                }
                localStorage.setItem('lumina_bookings', JSON.stringify(state.bookings));
            }

            this.syncPatients(); // Update patient stats
            this.closeModal();
            this.showNotification('Visita y consumos registrados correctamente');
            this.renderMyBookings();
        },

        // ENH-25: Reports
        updateReportFilter(key, value) {
            if (key === 'clear') {
                state.reportFilters = { startDate: '', endDate: '', professionalId: '' };
            } else {
                state.reportFilters[key] = value;
            }
            this.renderReports();
        },

        renderReports() {
            const user = state.currentUser;
            // Allow Admin and Professional
            if (user.role !== 'admin' && user.role !== 'professional') return;

            const main = document.getElementById('main-content');
            const isAdmin = user.role === 'admin';

            // Filter Logic
            const { startDate, endDate, professionalId } = state.reportFilters;

            let filteredVisits = state.visits;

            // Security Filter: Professionals only see their own
            if (!isAdmin) {
                filteredVisits = filteredVisits.filter(v => parseInt(v.professionalId) === user.id);
            }
            // Admin Filter: Can filter by any professional
            else if (professionalId) {
                filteredVisits = filteredVisits.filter(v => v.professionalId == professionalId);
            }

            // Date Filters
            if (startDate) {
                filteredVisits = filteredVisits.filter(v => v.date >= startDate);
            }
            if (endDate) {
                filteredVisits = filteredVisits.filter(v => v.date <= endDate);
            }

            // Calculate Totals by Professional (for Admin Matrix or Personal Total)
            const reportData = {};

            filteredVisits.forEach(v => {
                if (!reportData[v.professionalId]) {
                    reportData[v.professionalId] = {
                        name: state.professionals.find(p => p.id === parseInt(v.professionalId))?.name || 'Desconocido',
                        cash: 0, card: 0, transfer: 0, total: 0
                    };
                }

                const amount = v.price || 0;
                if (v.paymentMethod === 'Efectivo') reportData[v.professionalId].cash += amount;
                else if (v.paymentMethod === 'Tarjeta') reportData[v.professionalId].card += amount;
                else if (v.paymentMethod === 'Transferencia') reportData[v.professionalId].transfer += amount;

                reportData[v.professionalId].total += amount;
            });

            // For Professionals: Calculate single total
            const myTotal = isAdmin ? 0 : (reportData[user.id]?.total || 0);

            main.innerHTML = `
            <section class="section">
                <div class="container">
                    <div class="section-header">
                        <h2>${isAdmin ? 'Reporte de Ingresos' : 'Mis Ingresos'}</h2>
                        <p>${isAdmin ? 'Resumen financiero por profesional' : 'Detalle de tus turnos y ganancias'}</p>
                    </div>
                    
                    ${isAdmin ?
                    `<button onclick="turnoApp.navigate('admin')" class="btn-secondary" style="margin-bottom: 2rem;">← Volver a Reservas</button>` :
                    `<button onclick="turnoApp.navigate('home')" class="btn-secondary" style="margin-bottom: 2rem;">← Volver al Inicio</button>`
                }

                     <!-- Filters -->
                    <div class="filters-bar">
                        <div class="filter-group">
                            <label class="filter-label">Desde</label>
                            <input type="date" class="filter-select" value="${startDate}" onchange="turnoApp.updateReportFilter('startDate', this.value)">
                        </div>
                        <div class="filter-group">
                            <label class="filter-label">Hasta</label>
                            <input type="date" class="filter-select" value="${endDate}" onchange="turnoApp.updateReportFilter('endDate', this.value)">
                        </div>
                        
                        ${isAdmin ? `
                        <div class="filter-group">
                            <label class="filter-label">Profesional</label>
                            <select class="filter-select" onchange="turnoApp.updateReportFilter('professionalId', this.value)">
                                <option value="">Todos</option>
                                ${state.professionals.map(p => `<option value="${p.id}" ${p.id == professionalId ? 'selected' : ''}>${p.name}</option>`).join('')}
                            </select>
                        </div>
                        ` : ''}

                        <button onclick="turnoApp.updateReportFilter('clear')" class="btn-filter-clear">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> Limpiar
                        </button>
                    </div>

                    ${!isAdmin ? `
                        <div class="card" style="margin-bottom: 2rem; text-align: center; padding: 2rem;">
                            <h3 style="color: #666; font-size: 1.1rem; margin-bottom: 0.5rem;">Total Acumulado (Período Seleccionado)</h3>
                            <div style="font-size: 2.5rem; font-weight: bold; color: var(--primary);">$${myTotal}</div>
                        </div>
                    ` : ''}

                    ${isAdmin ? `
                    <div style="overflow-x: auto;">
                        <table class="admin-table">
                            <thead>
                                <tr>
                                    <th>Profesional</th>
                                    <th>Efectivo</th>
                                    <th>Tarjeta</th>
                                    <th>Transferencia</th>
                                    <th>TOTAL</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${Object.values(reportData).map(row => `
                                    <tr>
                                        <td><strong>${row.name}</strong></td>
                                        <td>$${row.cash}</td>
                                        <td>$${row.card}</td>
                                        <td>$${row.transfer}</td>
                                        <td style="color: var(--primary-dark); font-weight: bold;">$${row.total}</td>
                                    </tr>
                                `).join('')}
                                ${Object.keys(reportData).length === 0 ? '<tr><td colspan="5" class="text-center">No hay visitas que coincidan con los filtros.</td></tr>' : ''}
                            </tbody>
                        </table>
                    </div>
                    ` : ''}


                ${(Object.keys(reportData).length > 0 || !isAdmin) ? `
                <div style="text-align: center; margin-top: 1rem; color: #666; font-size: 0.9rem;">
                    ℹ️ Haz clic en una transacción abajo para ver más detalles.
                </div>
                ` : ''}

                    <div class="section-header" style="margin-top: 3rem;">
                        <h3>${isAdmin ? 'Detalle de Movimientos' : 'Detalle de Mis Turnos'}</h3>
                        <p>Desglose de visitas realizadas</p>
                    </div>

                    <div style="overflow-x: auto;">
                        <table class="admin-table">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Paciente</th>
                                    ${isAdmin ? '<th>Profesional</th>' : ''}
                                    <th>Tratamiento</th>
                                    <th>Monto</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filteredVisits.sort((a, b) => new Date(b.date) - new Date(a.date)).map(v => {
                    const booking = state.bookings.find(b => b.id === v.bookingId);
                    const prof = state.professionals.find(p => p.id === parseInt(v.professionalId));
                    return `
                                    <tr onclick="turnoApp.showTransactionDetails(${v.id})" style="cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                                        <td>${v.date}</td>
                                        <td>${booking ? booking.clientName : 'Cliente Externo'}</td>
                                        ${isAdmin ? `<td>${prof ? prof.name : 'Desconocido'}</td>` : ''}
                                        <td>${v.treatment || 'Servicio'}</td>
                                        <td style="font-weight: bold;">$${v.price}</td>
                                    </tr>
                                    `;
                }).join('')}
                                ${filteredVisits.length === 0 ? '<tr><td colspan="5" class="text-center">No hay movimientos.</td></tr>' : ''}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        `;
        },



        applyAdminFilters() {
            state.adminFilters.professionalId = document.getElementById('filter-prof').value;
            state.adminFilters.status = document.getElementById('filter-status').value;
            // Month filter applies to List view mainly, but could sync with Calendar
            if (document.getElementById('filter-month')) {
                state.adminFilters.month = document.getElementById('filter-month').value;
            }
            this.renderAdmin();
        },

        clearAdminFilters() {
            state.adminFilters = { professionalId: '', status: '', month: '' };
            this.renderAdmin();
        },

        // Toggle Admin View Mode
        setAdminViewMode(mode) {
            state.agendaView.viewMode = mode;
            this.renderAdmin();
        },

        changeCalendarMonth(delta) {
            state.agendaView.calendarMonth += delta;
            if (state.agendaView.calendarMonth > 11) {
                state.agendaView.calendarMonth = 0;
                state.agendaView.calendarYear++;
            } else if (state.agendaView.calendarMonth < 0) {
                state.agendaView.calendarMonth = 11;
                state.agendaView.calendarYear--;
            }
            this.renderAdmin();
        },

        getProfColor(profId) {
            const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444', '#14b8a6', '#f43f5e', '#84cc16', '#6366f1'];
            let hash = 0;
            if (profId) hash = parseInt(profId);
            return colors[hash % colors.length] || '#64748b';
        },

        getAdminWeekHTML() {
            const currentDate = state.agendaView.selectedDay ? new Date(state.agendaView.selectedDay) : new Date();
            const dayOfWeek = currentDate.getDay(); // 0 (Sun) - 6 (Sat)
            const diff = currentDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust when day is Sunday
            const startOfWeek = new Date(currentDate.setDate(diff));
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);

            const startStr = startOfWeek.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
            const endStr = endOfWeek.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

            const startHour = 6;
            const endHour = 23;
            const pixelsPerMinute = 1; // 1 min = 1px

            // Build Header
            let headerHTML = '<div class="timetable-header-grid"><div class="timetable-time-axis-header"></div>';
            const days = [];
            for (let i = 0; i < 7; i++) {
                const dayDate = new Date(startOfWeek);
                dayDate.setDate(startOfWeek.getDate() + i);
                const dateStr = dayDate.toISOString().split('T')[0];
                const dayName = dayDate.toLocaleDateString('es-ES', { weekday: 'short' });
                const dayNum = dayDate.getDate();
                const isToday = new Date().toISOString().split('T')[0] === dateStr;

                days.push({ dateStr, dayDate, isToday });
                headerHTML += `<div class="timetable-day-header ${isToday ? 'today' : ''}">
                    <div style="text-transform: capitalize; font-size: 0.85rem;">${dayName}</div>
                    <div style="font-size: 1.2rem;">${dayNum}</div>
                </div>`;
            }
            headerHTML += '</div>';

            // Build Time Axis
            let timeAxisHTML = '<div class="timetable-time-axis">';
            for (let h = startHour; h <= endHour; h++) {
                const label = `${h.toString().padStart(2, '0')}:00`;
                timeAxisHTML += `<div class="time-label-slot"><span>${label}</span></div>`;
            }
            timeAxisHTML += '</div>';

            // Build Columns
            let columnsHTML = '';
            for (let day of days) {
                const dayBookings = state.bookings.filter(b =>
                    b.date === day.dateStr &&
                    b.status !== 'Cancelado' &&
                    (!state.adminFilters.professionalId || b.professionalId == state.adminFilters.professionalId)
                );

                // Overlap resolver algorithm
                dayBookings.sort((a, b) => a.time.localeCompare(b.time));
                const groups = [];
                for (let b of dayBookings) {
                    const parts = b.time.split(':');
                    const startMin = parseInt(parts[0]) * 60 + parseInt(parts[1]);
                    const endMin = startMin + (b.duration || 30);
                    b.startMin = startMin;
                    b.endMin = endMin;

                    let placed = false;
                    for (let g of groups) {
                        if (g.some(gb => Math.max(startMin, gb.startMin) < Math.min(endMin, gb.endMin))) {
                            g.push(b);
                            placed = true;
                            break;
                        }
                    }
                    if (!placed) {
                        groups.push([b]);
                    }
                }

                for (let g of groups) {
                    const count = g.length;
                    g.forEach((b, index) => {
                        b.widthPct = 95 / count;
                        b.leftPct = (100 / count) * index;
                    });
                }

                // Render Background Slots
                let slotsHTML = '';
                for (let h = startHour; h <= endHour; h++) {
                    const t1 = `${h.toString().padStart(2, '0')}:00`;
                    const t2 = `${h.toString().padStart(2, '0')}:30`;
                    slotsHTML += `<div class="time-slot" onclick="turnoApp.showAdminBookingModal('${day.dateStr}', '${t1}')"></div>`;
                    slotsHTML += `<div class="time-slot" onclick="turnoApp.showAdminBookingModal('${day.dateStr}', '${t2}')"></div>`;
                }

                // Render Bookings Objects
                let bookingsHTML = '';
                for (let b of dayBookings) {
                    const startOffset = (b.startMin - (startHour * 60)) * pixelsPerMinute;
                    const bHeight = (b.duration || 30) * pixelsPerMinute - 2;

                    if (startOffset < 0) continue;

                    bookingsHTML += `
                    <div class="booking-block" 
                         onclick="event.stopPropagation(); turnoApp.editBooking(${b.id})"
                         style="top: ${startOffset}px; height: ${bHeight}px; left: ${b.leftPct}%; width: ${b.widthPct}%; background: ${turnoApp.getProfColor(b.professionalId)};">
                        <div class="booking-title">${b.time} ${b.clientName.split(' ')[0]}</div>
                        <div class="booking-subtitle">${b.serviceName}</div>
                    </div>`;
                }

                // Render Red Line if Today matches
                let currentTimeHTML = '';
                if (day.isToday) {
                    const now = new Date();
                    const nowMin = now.getHours() * 60 + now.getMinutes();
                    if (nowMin >= startHour * 60 && nowMin <= (endHour + 1) * 60) {
                        const topOffset = (nowMin - (startHour * 60)) * pixelsPerMinute;
                        currentTimeHTML = `<div class="current-time-line" style="top: ${topOffset}px;"><div class="current-time-indicator"></div></div>`;
                    }
                }

                columnsHTML += `<div class="timetable-day-column ${day.isToday ? 'today' : ''}">
                    ${slotsHTML}
                    ${bookingsHTML}
                    ${currentTimeHTML}
                </div>`;
            }

            let weekGrid = `
            <div class="timetable-container" id="week-timetable-scroll">
                ${headerHTML}
                <div class="timetable-body">
                    ${timeAxisHTML}
                    ${columnsHTML}
                </div>
            </div>`;

            return `
                    <div class="calendar-container">
                        <div class="calendar-header" style="margin-bottom: 1rem;">
                             <button onclick="turnoApp.changeWeek(-1)" class="btn-icon">←</button>
                             <h3 style="margin: 0; display: flex; align-items: center;">Semana ${startStr} - ${endStr}</h3>
                             <button onclick="turnoApp.changeWeek(1)" class="btn-icon">→</button>
                        </div>
                        ${weekGrid}
                    </div>`;
        },

        changeWeek(direction) {
            const current = new Date(state.agendaView.selectedDay || new Date());
            current.setDate(current.getDate() + (direction * 7));
            state.agendaView.selectedDay = current;
            state.agendaView.calendarMonth = current.getMonth();
            state.agendaView.calendarYear = current.getFullYear();
            this.renderAdmin();
        },

        // Helper to select a day from week view and optionally switch to day view?
        // For now just updates selection
        changeWeekDay(dateStr) {
            state.agendaView.selectedDay = new Date(dateStr);
            this.renderAdmin();
        },

        getAdminDayHTML() {
            const dateStr = state.agendaView.selectedDay ? new Date(state.agendaView.selectedDay).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
            const dateObj = new Date(dateStr + 'T12:00:00');
            const prettyDate = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

            const profFilterId = state.adminFilters.professionalId;

            const dayBookings = state.bookings
                .filter(b => b.date === dateStr && b.status !== 'Cancelado' && (!profFilterId || b.professionalId == profFilterId))
                .sort((a, b) => a.time.localeCompare(b.time));

            let dayGrid = '';

            // 1. General View (List Mode) if no professional selected
            // Or Timeline View? Let's do Timeline if Professional Selected, List if All

            if (!profFilterId) {
                // List View (All Professionals)
                dayGrid += `<div class="day-view-container" style="display: flex; flex-direction: column; gap: 0.75rem;">`;
                if (dayBookings.length === 0) {
                    dayGrid += `<div style="padding: 3rem; text-align: center; color: #94a3b8; background: #f8fafc; border-radius: 8px;">No hay turnos para este día.</div>`;
                } else {
                    dayGrid += dayBookings.map(b => `
                                <div style="display: flex; gap: 1rem; padding: 1rem; border: 1px solid #e2e8f0; border-radius: 8px; align-items: center; background: white; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                                    <div style="font-weight: 700; font-size: 1.1rem; width: 60px; color: var(--primary); text-align:center;">${b.time}</div>
                                    <div style="width: 4px; height: 40px; background: ${this.getServiceColor(b.serviceId)}; border-radius: 2px;"></div>
                                    <div style="flex: 1;">
                                        <div style="font-weight: 600; color: #1e293b;">${b.clientName}</div>
                                        <div style="font-size: 0.9rem; color: #64748b;">${b.serviceName} con <strong>${b.professionalName}</strong></div>
                                    </div>
                                    <div>
                                         <span class="status-badge ${b.status.toLowerCase()}">${b.status}</span>
                                    </div>
                                    <div>
                                         <button onclick="turnoApp.editBooking(${b.id})" class="btn-secondary" style="padding: 6px 12px; font-size: 0.85rem;">Ver</button>
                                    </div>
                                </div>
                             `).join('');
                }
                dayGrid += `</div>`;
            } else {
                // Timeline View (Specific Professional)
                dayGrid += `<div class="timeline-container" style="display: grid; gap: 1px; background: #e2e8f0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">`;

                // Determine Availability
                const prof = state.professionals.find(p => p.id == profFilterId);
                let startHour = 9;
                let endHour = 19;
                let isCountDay = true; // Assume working day unless blocked

                if (prof && prof.availability) {
                    // Check Blockouts
                    if (this.isDateFullyBlocked(prof.availability.blockouts, dateStr)) {
                        dayGrid += `<div style="padding: 2rem; text-align: center; background: #fff1f2; color: #be123c;">
                            Profesional no disponible en esta fecha (Día Bloqueado/Vacaciones).
                        </div>`;
                        isCountDay = false;
                    } else {
                        // Check Schedule for this day of week
                        const dayName = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' }); // Mon, Tue...
                        const schedule = prof.availability.schedule[dayName];

                        if (!schedule || schedule.length === 0) {
                            dayGrid += `<div style="padding: 2rem; text-align: center; background: #fff1f2; color: #be123c;">
                                Profesional no atiende los ${prettyDate.split(' ')[0]}s.
                            </div>`;
                            isCountDay = false;
                        } else {
                            // Parse start/end from schedule (simplified: take min start and max end of ranges)
                            // Example format: "09:00-13:00"
                            const times = schedule.map(s => s.split('-')).flat();
                            // If complex ranges, we might just iterate standard main block or all.
                            // For this UI loop, let's find min/max to render the grid
                            const hours = times.map(t => parseInt(t.split(':')[0]));
                            startHour = Math.min(...hours);
                            endHour = Math.max(...hours) - 1; // Loop goes <= endHour? No, loop renders slot starting at h. So if ends 17:00, last slot is 16:00.
                            // If schedule is 09:00-17:00. endHour should be 16 to render 16:00 slot?
                            // Logic below uses h <= endHour.
                            // If range is 09:00-17:00. We want slots 9,10,11,12,13,14,15,16.
                            // So max hour is 17. We want loop to run until 16.

                            // Let's just fix render to 8-20 range but mark unavailable? 
                            // Or dynamic:
                            endHour = Math.max(...hours);
                            // If exact match logic is needed inside loop:
                        }
                    }
                }

                if (isCountDay) {
                    for (let h = startHour; h < endHour; h++) {
                        const timeSlot = `${h.toString().padStart(2, '0')}:00`;
                        const booking = dayBookings.find(b => b.time.startsWith(timeSlot.split(':')[0])); // Simple match hour

                        // Check specific range availability (e.g. lunch break)
                        let isWorkingHour = true;
                        if (prof && prof.availability) {
                            const dayName = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' });
                            const schedule = prof.availability.schedule[dayName];
                            if (schedule) {
                                // Check if current h is inside any range
                                // Range "09:00-13:00". 09, 10, 11, 12 are valid. 13 is not (end time).
                                isWorkingHour = schedule.some(range => {
                                    const [start, end] = range.split('-');
                                    const sH = parseInt(start.split(':')[0]);
                                    const eH = parseInt(end.split(':')[0]);
                                    return h >= sH && h < eH;
                                });
                            }

                            // Apply time-specific blockouts (slots are 60m blocks in this view)
                            if (isWorkingHour && this.isTimeBlocked(prof.availability.blockouts, dateStr, h * 60, 60)) {
                                isWorkingHour = false;
                            }
                        }

                        if (booking) {
                            dayGrid += `
                                <div onclick="turnoApp.editBooking(${booking.id})" style="background: white; padding: 1rem; display: flex; gap: 1rem; align-items: center; border-left: 4px solid ${this.getServiceColor(booking.serviceId)}; cursor: pointer;">
                                    <div style="width: 60px; font-weight: 600; color: #64748b;">${timeSlot}</div>
                                    <div style="flex: 1;">
                                        <div style="font-weight: 600;">${booking.clientName}</div>
                                        <div style="font-size: 0.85rem; color: #64748b;">${booking.serviceName}</div>
                                    </div>
                                    <span class="status-badge ${booking.status.toLowerCase()}">${booking.status}</span>
                                </div>
                            `;
                        } else if (!isWorkingHour) {
                            dayGrid += `
                                <div style="background: #f8fafc; padding: 1rem; display: flex; gap: 1rem; align-items: center; opacity: 0.7;">
                                    <div style="width: 60px; font-weight: 600; color: #cbd5e1;">${timeSlot}</div>
                                    <div style="font-style: italic; color: #cbd5e1;">No disponible / Descanso</div>
                                </div>
                            `;
                        } else {
                            // Free Slot
                            dayGrid += `
                                <div onclick="turnoApp.showAdminBookingModal('${dateStr}', '${timeSlot}', '${profFilterId}')" style="background: white; padding: 1rem; display: flex; gap: 1rem; align-items: center; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#f0fdf4'; this.querySelector('.add-text').style.opacity='1';" onmouseout="this.style.background='white'; this.querySelector('.add-text').style.opacity='0';">
                                    <div style="width: 60px; font-weight: 600; color: #64748b;">${timeSlot}</div>
                                    <div style="color: #10b981; font-size: 0.9rem; font-weight: 500; display: flex; align-items: center; gap: 0.5rem; flex: 1;">
                                        <span style="width: 8px; height: 8px; background: #10b981; border-radius: 50%; display: inline-block;"></span>
                                        Disponible
                                        <span class="add-text" style="margin-left: auto; color: #10b981; opacity: 0; font-weight: 600; transition: opacity 0.2s;">+ Agendar</span>
                                    </div>
                                </div>
                            `;
                        }
                    }
                }
                dayGrid += `</div>`;
            }

            return `
                    <div class="calendar-container">
                        <div class="calendar-header">
                             <button onclick="turnoApp.changeDay(-1)" class="btn-icon">←</button>
                             <h3 style="text-transform: capitalize;">${prettyDate}</h3>
                             <button onclick="turnoApp.changeDay(1)" class="btn-icon">→</button>
                        </div>
                        
                        ${!profFilterId ?
                    `<div style="margin-bottom: 1.5rem; padding: 1rem; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; color: #0369a1; font-size: 0.9rem;">
                            💡 Selecciona un profesional en los filtros de arriba para ver la disponibilidad horaria detallada (Timeline).
                         </div>` : ''}

                        ${dayGrid}
                    </div>`;
        },

        changeDay(direction) {
            const current = new Date(state.agendaView.selectedDay || new Date());
            current.setDate(current.getDate() + direction);
            state.agendaView.selectedDay = current;
            state.agendaView.calendarMonth = current.getMonth();
            state.agendaView.calendarYear = current.getFullYear();
            this.renderAdmin();
        },

        getServiceColor(serviceId) {
            const colors = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
            return colors[serviceId % colors.length] || '#64748b';
        },



        renderDashboard() {
            const main = document.getElementById('main-content');
            const user = state.currentUser;
            const isProf = user.role === 'professional';

            // Calculation for KPIs
            const today = new Date().toISOString().split('T')[0];
            const currentMonth = today.slice(0, 7);

            // 1. Turnos de Hoy
            const todaysBookings = state.bookings.filter(b => b.date === today && b.status !== 'Cancelado' && (!isProf || b.professionalId == user.id));

            // 2. Ingresos Mes
            const monthVisits = state.visits.filter(v => v.date.startsWith(currentMonth) && (!isProf || v.professionalId == user.id));
            const totalIncome = monthVisits.reduce((sum, v) => sum + (v.price || 0), 0);

            // 3. Pacientes Activos
            let activePatientsCount = 0;
            if (isProf) {
                const myClients = new Set(state.bookings.filter(b => b.professionalId == user.id).map(b => b.clientEmail));
                activePatientsCount = myClients.size;
            } else {
                activePatientsCount = state.patients.length;
            }

            // 4. Pending Tasks (News)
            const pendingBookings = state.bookings.filter(b => b.status === 'Pendiente' && (!isProf || b.professionalId == user.id))
                .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

            main.innerHTML = `
            <section class="section">
                <div class="container">
                    <div class="section-header">
                        <h2>Dashboard</h2>
                        <p>Bienvenido, ${user.name.split(' ')[0]}</p>
                    </div>

                    <!-- KPI Cards -->
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-bottom: 2.5rem;">
                        <div class="card" style="padding: 1.5rem; text-align: center;">
                            <h3 style="color: #64748b; font-size: 0.9rem; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em;">Turnos Hoy</h3>
                            <div style="font-size: 2.5rem; font-weight: 700; color: var(--primary);">${todaysBookings.length}</div>
                        </div>
                        <div class="card" style="padding: 1.5rem; text-align: center;">
                            <h3 style="color: #64748b; font-size: 0.9rem; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em;">Ingresos Mes</h3>
                            <div style="font-size: 2.5rem; font-weight: 700; color: #10b981;">$${totalIncome}</div>
                        </div>
                        <div class="card" style="padding: 1.5rem; text-align: center;">
                            <h3 style="color: #64748b; font-size: 0.9rem; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em;">Pacientes ${isProf ? 'Míos' : 'Total'}</h3>
                            <div style="font-size: 2.5rem; font-weight: 700; color: #64748b;">${activePatientsCount}</div>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem;">
                        
                        <!-- Col 1: Pending Tasks -->
                        <div>
                            <h3 style="font-size: 1.2rem; color: #334155; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                                <i data-lucide="clipboard-list"></i> Tareas Pendientes
                                ${pendingBookings.length > 0 ? `<span style="background: #ef4444; color: white; font-size: 0.8rem; padding: 2px 8px; border-radius: 99px;">${pendingBookings.length}</span>` : ''}
                            </h3>
                            
                            <div style="background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">
                                ${pendingBookings.length > 0 ? pendingBookings.map(b => `
                                    <div style="padding: 1rem; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
                                        <div>
                                            <div style="font-weight: 600; color: #334155;">${b.clientName}</div>
                                            <div style="font-size: 0.85rem; color: #64748b;">${b.serviceName} • ${new Date(b.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} ${b.time}</div>
                                            ${!isProf ? `<div style="font-size: 0.8rem; color: #94a3b8;">Prof: ${b.professionalName}</div>` : ''}
                                        </div>
                                        <div style="display: flex; gap: 0.5rem;">
                                            <button onclick="turnoApp.updateBookingStatus(${b.id}, 'Confirmado')" title="Confirmar" style="background: #dcfce7; color: #166534; border: none; width: 32px; height: 32px; border-radius: 6px; cursor: pointer; display: grid; place-items: center;"><i data-lucide="check" size="16"></i></button>
                                            <button onclick="turnoApp.updateBookingStatus(${b.id}, 'Cancelado')" title="Cancelar" style="background: #fee2e2; color: #991b1b; border: none; width: 32px; height: 32px; border-radius: 6px; cursor: pointer; display: grid; place-items: center;"><i data-lucide="x" size="16"></i></button>
                                        </div>
                                    </div>
                                `).join('') : `
                                    <div style="padding: 2rem; text-align: center; color: #94a3b8;">
                                        <i data-lucide="check-circle-2" size="32" style="margin-bottom: 0.5rem; opacity: 0.5;"></i>
                                        <p>¡Todo al día! No hay turnos pendientes.</p>
                                    </div>
                                `}
                            </div>
                        </div>

                        <!-- Col 2: Quick Access -->
                        <div>
                             <h3 style="font-size: 1.2rem; color: #334155; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                                <i data-lucide="zap"></i> Accesos Rápidos
                            </h3>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <button onclick="turnoApp.navigate('booking')" class="btn-secondary" style="height: auto; padding: 2rem 1.5rem; flex-direction: column; gap: 1rem; text-align: center; border: none; background: #e0f2fe; color: var(--primary); transition: transform 0.2s, filter 0.2s;" onmouseover="this.style.filter='brightness(0.95)'" onmouseout="this.style.filter='brightness(1)'">
                                    <i data-lucide="plus-circle" size="40"></i>
                                    <span style="font-weight: 600; font-size: 1.15rem;">Nuevo Turno</span>
                                </button>
                                <button onclick="turnoApp.showCreatePatientModal()" class="btn-secondary" style="height: auto; padding: 2rem 1.5rem; flex-direction: column; gap: 1rem; text-align: center; border: none; background: #f1f5f9; color: #475569; transition: transform 0.2s, filter 0.2s;" onmouseover="this.style.filter='brightness(0.95)'" onmouseout="this.style.filter='brightness(1)'">
                                    <i data-lucide="user-plus" size="40"></i>
                                    <span style="font-weight: 600; font-size: 1.15rem;">Nuevo Paciente</span>
                                </button>
                                ${!isProf ? `
                                <button onclick="turnoApp.navigate('reports')" class="btn-secondary" style="height: auto; padding: 2rem 1.5rem; flex-direction: column; gap: 1rem; text-align: center; border: none; background: #f0fdf4; color: #166534; transition: transform 0.2s, filter 0.2s;" onmouseover="this.style.filter='brightness(0.95)'" onmouseout="this.style.filter='brightness(1)'">
                                    <i data-lucide="bar-chart-3" size="40"></i>
                                    <span style="font-weight: 600; font-size: 1.15rem;">Ver Reportes</span>
                                </button>
                                <button onclick="turnoApp.navigate('admin')" class="btn-secondary" style="height: auto; padding: 2rem 1.5rem; flex-direction: column; gap: 1rem; text-align: center; border: none; background: #fff7ed; color: #c2410c; transition: transform 0.2s, filter 0.2s;" onmouseover="this.style.filter='brightness(0.95)'" onmouseout="this.style.filter='brightness(1)'">
                                    <i data-lucide="calendar" size="40"></i>
                                    <span style="font-weight: 600; font-size: 1.15rem;">Ir a Agenda</span>
                                </button>
                                ` : ''}
                            </div>
                        </div>
                    </div>

                </div>
            </section>
            `;

            if (window.lucide) lucide.createIcons();
        },

        updateBookingStatus(id, newStatus) {
            const booking = state.bookings.find(b => b.id === id);
            if (booking) {
                booking.status = newStatus;
                // Update LocalStorage
                localStorage.setItem('lumina_bookings', JSON.stringify(state.bookings));

                // If Completed, add to Visits logic? (Simplified: Handled in reports by filtering 'Completado')
                if (newStatus === 'Completado') {
                    // Check if visit already exists
                    // For now, Report filtering handles it.
                }

                this.showNotification(`Turno ${newStatus.toLowerCase()} correctamente`);
                this.renderDashboard(); // Refresh dashboard
            }
        },

        renderAdmin() {
            const user = state.currentUser;
            if (!user) return;

            // SECURITY: If Professional, force filter to their ID
            if (user.role === 'professional') {
                state.adminFilters.professionalId = user.id;
            }

            const main = document.getElementById('main-content');
            const viewMode = state.agendaView.viewMode || 'month';

            // --- FILTER BAR (Dynamic based on role) ---
            let filterBarHTML = `
            <div class="filters-bar" style="margin-bottom: 2rem;">
                ${user.role === 'admin' ? `
                <div class="filter-group">
                    <label class="filter-label">Profesional</label>
                    <select id="filter-prof" class="filter-select" onchange="turnoApp.applyAdminFilters()">
                        <option value="">Todos</option>
                        ${state.professionals.map(p => `<option value="${p.id}" ${state.adminFilters.professionalId == p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
                    </select>
                </div>
                ` : `
                <div class="filter-group">
                    <label class="filter-label">Profesional</label>
                    <div style="padding: 0.6rem 1rem; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); color: var(--text-main); font-size: 0.95rem;">
                        ${state.professionals.find(p => p.id === user.id)?.name || 'Tú'}
                        <input type="hidden" id="filter-prof" value="${user.id}">
                    </div>
                </div>
                `}
                
                <div class="filter-group">
                    <label class="filter-label">Estado</label>
                     <select id="filter-status" class="filter-select" onchange="turnoApp.applyAdminFilters()">
                        <option value="">Todos</option>
                        <option value="Pendiente" ${state.adminFilters.status === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                        <option value="Confirmado" ${state.adminFilters.status === 'Confirmado' ? 'selected' : ''}>Confirmado</option>
                        <option value="Completado" ${state.adminFilters.status === 'Completado' ? 'selected' : ''}>Completado</option>
                        <option value="Cancelado" ${state.adminFilters.status === 'Cancelado' ? 'selected' : ''}>Cancelado</option>
                    </select>
                </div>
            </div>
            `;

            let calendarHTML = '';
            if (viewMode === 'month') {
                calendarHTML = this.getAdminCalendarHTML();
            } else if (viewMode === 'week') {
                calendarHTML = this.getAdminWeekHTML();
            } else if (viewMode === 'day') {
                calendarHTML = this.getAdminDayHTML();
            }

            main.innerHTML = `
            <section class="section">
                <div class="container">
                    <div class="section-header">
                        <h2>Agenda ${user.role === 'admin' ? 'Global' : 'Personal'}</h2>
                        <div style="margin-top: 1rem; display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
                             <div class="view-toggle">
                                <button onclick="turnoApp.setAdminViewMode('month')" class="${viewMode === 'month' ? 'active' : ''}">Mes</button>
                                <button onclick="turnoApp.setAdminViewMode('week')" class="${viewMode === 'week' ? 'active' : ''}">Semana</button>
                                <button onclick="turnoApp.setAdminViewMode('day')" class="${viewMode === 'day' ? 'active' : ''}">Día</button>
                             </div>
                        </div>
                    </div>

                    ${filterBarHTML}

                    ${calendarHTML}
                </div>
            </section>
        `;

            if (viewMode === 'week') {
                requestAnimationFrame(() => {
                    const scrollEl = document.getElementById('week-timetable-scroll');
                    if (scrollEl) {
                        const now = new Date();
                        const currentMin = now.getHours() * 60 + now.getMinutes();
                        let targetScroll = 120; // 08:00 default
                        if (currentMin >= 360 && currentMin <= 1380) {
                            targetScroll = currentMin - 360 - 30; // 30px padding above current time
                        }
                        scrollEl.scrollTop = Math.max(0, targetScroll);
                    }
                });
            }
        },

        getAdminListHTML() {
            // Filter Logic
            let filteredBookings = state.bookings;

            if (state.adminFilters.professionalId) {
                filteredBookings = filteredBookings.filter(b => b.professionalId == state.adminFilters.professionalId);
            }
            if (state.adminFilters.status) {
                filteredBookings = filteredBookings.filter(b => b.status === state.adminFilters.status);
            }
            if (state.adminFilters.month) {
                filteredBookings = filteredBookings.filter(b => b.date.startsWith(state.adminFilters.month));
            }

            return `
            <!-- Filters Toolbar -->
            <div class="filters-bar">
                <div class="filter-group">
                    <label class="filter-label">Profesional</label>
                    <select id="filter-prof" class="filter-select" onchange="turnoApp.applyAdminFilters()">
                        <option value="">Todos</option>
                        ${state.professionals.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                    </select>
                </div>
                 <div class="filter-group">
                    <label class="filter-label">Estado</label>
                    <select id="filter-status" class="filter-select" onchange="turnoApp.applyAdminFilters()">
                        <option value="">Todos</option>
                        <option value="Confirmado">Confirmado</option>
                        <option value="Completado">Completado</option>
                        <option value="Cancelado">Cancelado</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label class="filter-label">Mes</label>
                    <input type="month" id="filter-month" class="filter-select" value="${state.adminFilters.month}" onchange="turnoApp.applyAdminFilters()">
                </div>
                <button onclick="turnoApp.clearAdminFilters()" class="btn-filter-clear">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> Limpiar
                </button>
            </div>

            <div style="overflow-x: auto;">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Hora</th>
                            <th>Profesional</th>
                            <th>Cliente</th>
                            <th>Servicio</th>
                            <th>Estado</th>
                            <th>Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredBookings.length ? filteredBookings.map(b => `
                            <tr>
                                <td>${b.date}</td>
                                <td>${b.time}</td>
                                <td><strong>${b.professionalName || '-'}</strong></td>
                                <td>${b.clientName}</td>
                                <td>${b.serviceName}</td>
                                <td><span class="status-badge ${b.status.toLowerCase()}">${b.status}</span></td>
                                <td>
                                    <button onclick="turnoApp.editBooking(${b.id})" style="background: none; border: 1px solid #ddd; padding: 4px 8px; cursor: pointer; border-radius: 4px;">Editar</button>
                                </td>
                            </tr>
                        `).join('') : '<tr><td colspan="7" class="text-center">No hay reservas con estos filtros.</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
        },

        // Transaction Details Modal (ENH-28)
        showTransactionDetails(visitId) {
            const visit = state.visits.find(v => v.id === visitId);
            if (!visit) return;

            const prof = state.professionals.find(p => p.id === parseInt(visit.professionalId));
            const booking = state.bookings.find(b => b.id === visit.bookingId);

            // Notes placeholder - in real app, fetch from DB
            const notes = visit.notes || (booking ? booking.notes : '') || "Sin notas registradas por el profesional.";

            const content = `
                <div class="modal-header" style="text-align: center; margin-bottom: 1.5rem;">
                    <h3 style="color: var(--primary); margin-bottom: 0.5rem;">Detalle de Transacción</h3>
                    <p style="color: #666; font-size: 0.9rem;">ID: #${visit.id}</p>
                </div>
                
                <div style="display: grid; gap: 1rem;">
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #eee; padding-bottom: 0.5rem;">
                        <span style="color: #666;">Tratamiento:</span>
                        <strong style="text-align: right;">${visit.treatment || 'Servicio General'}</strong>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #eee; padding-bottom: 0.5rem;">
                        <span style="color: #666;">Profesional:</span>
                        <strong>${prof ? prof.name : 'Desconocido'}</strong>
                    </div>
                    
                     <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #eee; padding-bottom: 0.5rem;">
                        <span style="color: #666;">Precio Unitario:</span>
                        <strong>$${visit.price}</strong>
                    </div>
                    
                     <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #eee; padding-bottom: 0.5rem;">
                        <span style="color: #666;">Cantidad:</span>
                        <strong>1</strong>
                    </div>
                    
                     <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #eee; padding-bottom: 0.5rem;">
                        <span style="color: #666;">Forma de Pago:</span>
                        <span class="status-badge completado">${visit.paymentMethod || 'No especificado'}</span>
                    </div>
                    
                    <div style="margin-top: 1rem;">
                        <h4 style="font-size: 1rem; margin-bottom: 0.5rem; color: var(--primary);">Notas del Profesional</h4>
                        <div style="background: #f9f9f9; padding: 1rem; border-radius: 8px; border: 1px solid #eee; font-style: italic; color: #555;">
                            "${notes}"
                        </div>
                    </div>

                    <button onclick="turnoApp.closeModal()" class="btn-primary" style="margin-top: 1.5rem; width: 100%;">Cerrar</button>
                </div>
            `;

            this.openModal(content);
        },

        getAdminCalendarHTML() {
            const year = state.agendaView.calendarYear;
            const month = state.agendaView.calendarMonth;

            const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

            // Calendar Logic
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            const daysInMonth = lastDay.getDate();
            const startDayOfWeek = firstDay.getDay(); // 0 = Sun

            // Bookings for this month
            const monthPrefix = `${year}-${(month + 1).toString().padStart(2, '0')}`;
            const monthBookings = state.bookings.filter(b => b.date.startsWith(monthPrefix) && b.status !== 'Cancelado');

            let calendarGrid = '';

            // Empty cells for days before start
            for (let i = 0; i < startDayOfWeek; i++) {
                calendarGrid += `<div class="calendar-day empty"></div>`;
            }

            // Days
            for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
                const dayBookings = monthBookings.filter(b => b.date === dateStr);
                const isToday = new Date().toISOString().split('T')[0] === dateStr;

                calendarGrid += `
                <div class="calendar-day ${isToday ? 'today' : ''}" style="position: relative;">
                    <button onclick="turnoApp.showAdminBookingModal('${dateStr}')" style="position: absolute; top: 4px; right: 4px; background: none; border: none; font-size: 1.2rem; line-height: 1; color: var(--primary); cursor: pointer; padding: 0; opacity: 0.6; z-index: 2;" title="Nuevo Turno">+</button>
                    <div class="day-content" onclick="${dayBookings.length > 0 ? `turnoApp.showDayDetails('${dateStr}')` : `turnoApp.showAdminBookingModal('${dateStr}')`}" style="height: 100%;">
                        <div class="day-number">${d}</div>
                        ${dayBookings.length > 0 ? `
                            <div class="day-indicators" style="display:flex; flex-direction:column; gap:2px; margin-top:4px;">
                                ${dayBookings.slice(0, 3).map(b => `
                                    <div class="day-booking-pill" title="${b.time} - ${b.serviceName} con ${b.professionalName}">
                                        ${b.time} ${b.clientName.split(' ')[0]}
                                    </div>
                                `).join('')}
                            </div>
                            ${dayBookings.length > 3 ? `<div class="day-count">+${dayBookings.length - 3} más</div>` : ''}
                        ` : ''}
                    </div>
                </div>
            `;
            }

            return `
            <div class="calendar-container">
                <div class="calendar-header">
                    <button onclick="turnoApp.changeCalendarMonth(-1)" class="btn-icon">←</button>
                    <h3>${monthNames[month]} ${year}</h3>
                    <button onclick="turnoApp.changeCalendarMonth(1)" class="btn-icon">→</button>
                </div>
                <div class="calendar-weekdays">
                    <div>Dom</div><div>Lun</div><div>Mar</div><div>Mié</div><div>Jue</div><div>Vie</div><div>Sáb</div>
                </div>
                <div class="calendar-grid">
                    ${calendarGrid}
                </div>
            </div>
        `;
        },

        showDayDetails(dateStr) {
            const bookings = state.bookings.filter(b => b.date === dateStr);
            if (bookings.length === 0) return;

            // Format date: "Turnos del miércoles 25 de marzo de 2026"
            const dateObj = new Date(dateStr + "T12:00:00");
            const prettyDate = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

            const content = `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 0.75rem; margin-bottom: 1rem;">
                <h3 style="margin: 0; text-transform: capitalize;">Turnos del ${prettyDate}</h3>
                <button onclick="turnoApp.showAdminBookingModal('${dateStr}')" class="btn-primary" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;">+ Nuevo Turno</button>
            </div>
            <div style="max-height: 400px; overflow-y: auto;">
                ${bookings.map(b => {
                const price = b.price || (state.services.find(s => s.id === b.serviceId)?.price || 0);
                const safeEmail = b.clientEmail ? b.clientEmail.replace(/'/g, "\\'") : '';
                return `
                    <div onclick="turnoApp.editBooking(${b.id})" style="padding: 1rem 0.5rem; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: stretch; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                        <div style="display: flex; flex-direction: column; justify-content: space-between; gap: 0.5rem;">
                            <div>
                                <strong>${b.time}</strong> - 
                                <a href="#" onclick="event.stopPropagation(); turnoApp.closeModal(); turnoApp.navigate('patient-profile', '${safeEmail}'); return false;" style="color: var(--primary); text-decoration: none; font-weight: 600;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${b.clientName}</a>
                                <br>
                                <span style="font-size: 0.9rem; color: #64748b;">${b.serviceName} con ${b.professionalName}</span>
                            </div>
                            <div style="font-size: 0.85rem; color: #475569; display: flex; gap: 1rem; align-items: center;">
                                <span style="display:inline-flex; align-items:center; gap:4px;"><i data-lucide="tag" style="width:14px; height:14px;"></i> $${price}</span>
                                <span style="display:inline-flex; align-items:center; gap:4px;"><i data-lucide="credit-card" style="width:14px; height:14px;"></i> ${b.paymentMethod || 'A confirmar'}</span>
                            </div>
                        </div>
                        <div style="text-align: right; display: flex; flex-direction: column; justify-content: space-between; align-items: flex-end;">
                             <span class="status-badge ${b.status.toLowerCase()}" style="font-size: 0.75rem;">${b.status}</span>
                             <div style="font-size: 0.8rem; color: var(--primary); font-weight: 500;">Editar</div>
                        </div>
                    </div>
                `}).join('')}
            </div>
             <div style="margin-top: 1.5rem; text-align: right;">
                <button onclick="turnoApp.closeModal()" class="btn-secondary">Cerrar</button>
            </div>
        `;
            this.openModal(content);
            setTimeout(() => { if (window.lucide) window.lucide.createIcons(); }, 10);
        },

        showAdminBookingModal(defaultDate = '', defaultTime = '', defaultProfId = '') {
            // Ensure data availability
            const patientsList = state.patients.map(p => `<option value="${p.email}">${p.name} (${p.email})</option>`).join('');

            // Build services list initially based on default professional
            let filteredServices = state.services;
            if (defaultProfId) {
                const prof = state.professionals.find(p => p.id == defaultProfId);
                if (prof && prof.serviceIds && prof.serviceIds.length > 0) {
                    filteredServices = state.services.filter(s => prof.serviceIds.includes(s.id));
                }
            }
            const servicesList = filteredServices.map(s => `<option value="${s.id}">${s.name} (${s.duration} min) - ${turnoApp.formatServicePrice(s)}</option>`).join('');

            const professionalsList = state.professionals.map(p => `<option value="${p.id}" ${p.id == defaultProfId ? 'selected' : ''}>${p.name}</option>`).join('');

            // Time increments to 30 mins
            let timeOptions = '<option value="">Seleccionar Hora...</option>';
            for (let h = 8; h <= 20; h++) {
                for (let m of ['00', '30']) {
                    const t = `${h.toString().padStart(2, '0')}:${m}`;
                    timeOptions += `<option value="${t}" ${defaultTime === t ? 'selected' : ''}>${t}</option>`;
                }
            }

            const content = `
                <div class="modal-header">
                    <h3>Nuevo Turno</h3>
                </div>
                <form onsubmit="turnoApp.confirmAdminBooking(event)">
                    <div class="form-group">
                        <label class="form-label">Paciente</label>
                        <div style="display: flex; gap: 0.5rem;">
                             <select name="clientEmail" class="form-select" required style="flex:1;">
                                <option value="">Seleccionar Paciente...</option>
                                ${patientsList}
                            </select>
                            <button type="button" onclick="turnoApp.showCreatePatientModal()" class="btn-secondary" title="Nuevo Paciente">+</button>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div class="form-group">
                            <label class="form-label">Fecha</label>
                            <input type="date" name="date" class="form-input" required value="${defaultDate || new Date().toISOString().split('T')[0]}" onchange="turnoApp.checkBookingConflict()">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Hora</label>
                            <select name="time" class="form-select" required onchange="turnoApp.checkBookingConflict()">
                                ${timeOptions}
                            </select>
                        </div>
                    </div>
                    
                    <div id="booking-conflict-warning" style="display: none; color: #b45309; background: #fef3c7; padding: 0.75rem; border-radius: 6px; font-size: 0.9rem; margin-bottom: 1rem; border: 1px solid #fde68a;">
                        ⚠️ Este profesional ya tiene un turno a esta hora.
                    </div>

                    <div class="form-group">
                         <label class="form-label">Profesional</label>
                         <select name="professionalId" class="form-select" required onchange="turnoApp.onProfChangeInBookingModal(this.value); turnoApp.checkBookingConflict()">
                            <option value="">Seleccionar Profesional...</option>
                            ${professionalsList}
                        </select>
                    </div>

                    <div class="form-group">
                         <label class="form-label">Servicio</label>
                         <select name="serviceId" class="form-select" required onchange="turnoApp.onServiceChangeInBookingModal(this.value)">
                            <option value="">Seleccionar Servicio...</option>
                            ${servicesList}
                        </select>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div class="form-group">
                            <label class="form-label">Método de pago</label>
                            <select name="paymentMethod" class="form-select" required>
                                <option value="A confirmar" selected>A confirmar</option>
                                <option value="Efectivo">Efectivo</option>
                                <option value="Tarjeta">Tarjeta</option>
                                <option value="Transferencia">Transferencia</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Monto</label>
                            <input type="number" name="price" id="booking-price" class="form-input" required placeholder="0">
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Notas (Opcional)</label>
                        <textarea name="notes" class="form-input" rows="2"></textarea>
                    </div>

                    <div style="margin-top: 1.5rem; text-align: right;">
                        <button type="button" onclick="turnoApp.closeModal()" class="btn-secondary" style="margin-right: 0.5rem;">Cancelar</button>
                        <button type="submit" class="btn-primary">Confirmar Turno</button>
                    </div>
                </form>
            `;
            this.openModal(content);

            // Auto-trigger validations
            setTimeout(() => {
                turnoApp.checkBookingConflict();
                const svcSelect = document.querySelector('select[name="serviceId"]');
                if (svcSelect && svcSelect.value) {
                    turnoApp.onServiceChangeInBookingModal(svcSelect.value);
                }
            }, 100);
        },

        onProfChangeInBookingModal(profId) {
            const serviceSelect = document.querySelector('select[name="serviceId"]');
            if (!serviceSelect) return;

            let filteredServices = state.services;
            if (profId) {
                const prof = state.professionals.find(p => p.id == profId);
                if (prof && prof.serviceIds && prof.serviceIds.length > 0) {
                    filteredServices = state.services.filter(s => prof.serviceIds.includes(s.id));
                }
            }

            serviceSelect.innerHTML = '<option value="">Seleccionar Servicio...</option>' +
                filteredServices.map(s => `<option value="${s.id}">${s.name} (${s.duration} min) - ${turnoApp.formatServicePrice(s)}</option>`).join('');

            serviceSelect.value = ''; // Reset selection
            turnoApp.onServiceChangeInBookingModal(''); // Update price
        },

        onServiceChangeInBookingModal(serviceId) {
            const priceInput = document.getElementById('booking-price');
            if (!priceInput) return;

            if (!serviceId) {
                priceInput.value = '';
                return;
            }
            const service = state.services.find(s => s.id == serviceId);
            if (service) {
                priceInput.value = service.price || 0;
            }
        },

        checkBookingConflict() {
            const profIdSelect = document.querySelector('select[name="professionalId"]');
            const dateInput = document.querySelector('input[name="date"]');
            const timeSelect = document.querySelector('select[name="time"]');
            const warningEl = document.getElementById('booking-conflict-warning');

            if (!profIdSelect || !dateInput || !timeSelect || !warningEl) return;

            const profId = profIdSelect.value;
            const date = dateInput.value;
            const time = timeSelect.value;

            if (profId && date && time) {
                const conflict = state.bookings.find(b => b.professionalId == profId && b.date === date && b.time === time && b.status !== 'Cancelado');
                warningEl.style.display = conflict ? 'block' : 'none';
            } else {
                warningEl.style.display = 'none';
            }
        },

        async confirmAdminBooking(e) {
            e.preventDefault();
            const form = e.target;
            const clientEmail = form.clientEmail.value;
            const date = form.date.value;
            const time = form.time.value;
            const serviceId = parseInt(form.serviceId.value);
            const professionalId = parseInt(form.professionalId.value);
            const notes = form.notes.value;
            const paymentMethod = form.paymentMethod ? form.paymentMethod.value : 'A confirmar';
            const price = form.price ? parseFloat(form.price.value) : 0;

            // Basic Validation
            if (!clientEmail || !date || !time || !serviceId || !professionalId) {
                alert('Por favor completa todos los campos requeridos.');
                return;
            }

            // Find related data objects
            const patient = state.patients.find(p => p.email === clientEmail);
            const service = state.services.find(s => s.id === serviceId);
            const professional = state.professionals.find(p => p.id === professionalId);

            // Construct booking object
            const newBooking = {
                id: Date.now(), // Mock ID
                date,
                time,
                serviceId,
                serviceName: service.name,
                duration: service.duration,
                professionalId,
                professionalName: professional.name,
                clientEmail,
                clientName: patient.name,
                clientPhone: patient.phone,
                paymentMethod,
                price,
                status: 'Confirmado',
                notes
            };

            // Save (Mock + Supabase would go here)
            // For now pushing to state and LS
            state.bookings.push(newBooking);

            // Sync logic (optional for this demo, usually handled by backend)
            // Save to DB?
            /* 
            const { error } = await supabase.from('bookings').insert([{ ...mapped_fields }]);
            if (error) { alert('Error al guardar'); return; }
            */

            localStorage.setItem('lumina_bookings', JSON.stringify(state.bookings));

            this.showNotification('Turno agendado correctamente', 'top-right');
            this.closeModal();
            this.renderAdmin(); // Refresh calendar
        },

        renderLogin() {
            const main = document.getElementById('main-content');
            main.innerHTML = `
            <section class="section">
                <div class="container">
                    <div class="login-container">
                        <div class="login-header">
                            <h2>Iniciar Sesión</h2>
                            <p>Accede a tu cuenta para gestionar tus turnos</p>
                        </div>
                        <form onsubmit="event.preventDefault(); turnoApp.login(this.email.value, this.password.value)">
                            <div class="form-group">
                                <label class="form-label text-left">Email</label>
                                <input type="email" name="email" class="form-input" required placeholder="tu@email.com">
                            </div>
                            <div class="form-group">
                                <label class="form-label text-left">Contraseña</label>
                                <input type="password" name="password" class="form-input" required>
                            </div>
                            <button type="submit" class="btn-primary" style="width: 100%">Ingresar</button>
                            <div class="text-center" style="margin-top: 1rem;">
                                <a href="#" onclick="event.preventDefault(); turnoApp.forgotPassword()" style="color: var(--primary); font-size: 0.9rem;">¿Olvidaste tu contraseña?</a>
                            </div>
                        </form>
                        <div style="margin-top: 1.5rem;">
                            <button onclick="turnoApp.navigate('register')" class="btn-secondary" style="width: 100%;">¿No tenés cuenta? Creá tu usuario</button>
                        </div>

                        <div class="auth-btn-group" style="margin-top: 2rem; border-top: 1px solid #eee; padding-top: 1rem;">
                    <button onclick="turnoApp.login('admin_v2@julielle.com', 'lumina2024')" style="background:none; border:none; color: #ccc; cursor: pointer; font-size: 0.8rem;">Demo Admin</button>
                    <button onclick="turnoApp.login('paciente_v2@test.com', 'lumina2024')" style="background:none; border:none; color: #ccc; cursor: pointer; font-size: 0.8rem;">Demo Paciente</button>
                    <button onclick="turnoApp.login('prof_v2@julielle.com', 'lumina2024')" style="background:none; border:none; color: #ccc; cursor: pointer; font-size: 0.8rem;">Demo Prof</button>
                </div>        </div>

                    </div>
                </div>
            </section>
        `;
        },

        renderRegister() {
            const main = document.getElementById('main-content');
            main.innerHTML = `
            <section class="section">
                <div class="container">
                    <div class="login-container">
                        <div class="login-header">
                            <h2>Crear Cuenta</h2>
                            <p>Regístrate para reservar tus turnos</p>
                        </div>
                        <form onsubmit="event.preventDefault(); turnoApp.register(this)">
                            <div class="form-group">
                                <label class="form-label text-left">Nombre Completo</label>
                                <input type="text" name="name" class="form-input" required placeholder="Tu nombre">
                            </div>
                            <div class="form-group">
                                <label class="form-label text-left">Email</label>
                                <input type="email" name="email" class="form-input" required placeholder="tu@email.com">
                            </div>
                            <div class="form-group">
                                <label class="form-label text-left">Contraseña</label>
                                <input type="password" name="password" class="form-input" required>
                            </div>
                            <button type="submit" class="btn-primary" style="width: 100%">Registrarse</button>
                        </form>
                        <div style="margin-top: 2rem; border-top: 1px solid #eee; padding-top: 1rem;">
                            <p>¿Ya tienes cuenta?</p>
                            <button onclick="turnoApp.navigate('login')" class="btn-secondary" style="margin-top: 0.5rem; width: 100%;">Iniciar Sesión</button>
                        </div>
                    </div>
                </div>
            </section>
        `;
        },

        async register(form) {
            const name = form.name.value;
            const email = form.email.value;
            const password = form.password.value;

            // 1. Sign Up
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
            });

            if (error) {
                alert('Error al registrarse: ' + error.message);
                return;
            }

            // 2. Create Profile & Handle Session
            if (data.user) {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .insert([
                        { id: data.user.id, email, name, role: 'patient', phone: '' }
                    ]);

                if (profileError) {
                    console.error("Profile creation failed:", profileError);
                }

                // CHECK POINT: Check if Supabase returned a session (Auto Login active)
                if (data.session) {
                    this.showNotification('Cuenta creada con éxito. Ingresando...');

                    // Initialize User State
                    await this.fetchUserProfile(data.user.id);

                    // Handle Pending Actions (Redirect Logic)
                    const pending = localStorage.getItem('lumina_pending_action');
                    if (pending) {
                        const { serviceId } = JSON.parse(pending);
                        localStorage.removeItem('lumina_pending_action'); // Clear it
                        this.navigate('booking');
                        if (serviceId) this.selectedService = serviceId;
                    } else {
                        // Default redirection
                        this.navigate('home');
                    }
                    this.updateNav();

                } else {
                    // No session = Email Confirmation Required
                    alert('Registro exitoso. Por favor revisa tu correo para confirmar tu cuenta antes de ingresar.');
                    this.navigate('login');
                }
            }
        },

        async setupDemoUsers() {
            if (!confirm('Esto intentará reparar los usuarios demo (Admin, Prof, Paciente). ¿Continuar?')) return;

            // Updated V2 credentials to ensure fresh accounts
            const demos = [
                { email: 'admin_v2@julielle.com', pass: 'lumina2024', role: 'admin', name: 'Admin Demo' },
                { email: 'prof_v2@julielle.com', pass: 'lumina2024', role: 'professional', name: 'Dra. Morcilla' },
                { email: 'paciente_v2@test.com', pass: 'lumina2024', role: 'patient', name: 'Paciente Demo' }
            ];

            this.showNotification('Iniciando reparación de usuarios...');

            try {
                await supabase.auth.signOut();

                for (const user of demos) {
                    // 1. SignUp
                    let { data, error } = await supabase.auth.signUp({
                        email: user.email,
                        password: user.pass,
                        options: { data: { name: user.name, role: user.role } }
                    });

                    let uid = data?.user?.id;

                    if (error) {
                        // Fallback login
                        const loginRes = await supabase.auth.signInWithPassword({
                            email: user.email,
                            password: user.pass
                        });

                        if (loginRes.data?.session) {
                            uid = loginRes.data.session.user.id;
                        }
                    }

                    if (uid) {
                        // 2. Restore Profile
                        await supabase.from('profiles').upsert({
                            id: uid,
                            email: user.email,
                            name: user.name,
                            role: user.role
                        });

                        // 3. Link Professional
                        if (user.role === 'professional') {
                            const { data: profs } = await supabase.from('professionals').select('*').eq('name', user.name);
                            if (profs && profs.length > 0) {
                                await supabase.from('professionals').update({ user_id: uid }).eq('id', profs[0].id);
                            }
                        }
                    }
                    await supabase.auth.signOut();
                }

                this.showNotification('¡Reparación Completa! Usa los botones Demo nuevos.');
                alert('Usuarios actualizados a V2. Usa los botones "Demo" para entrar.');

            } catch (err) {
                console.error(err);
                alert('Error: ' + err.message);
            }
        },

        renderMyBookings() {
            const main = document.getElementById('main-content');

            let myBookings = [];
            let title = "Mis Turnos";
            let subtitle = "Gestiona tus próximas citas";

            if (state.currentUser.role === 'professional') {
                // If professional, verify ID from users match ID in bookings
                myBookings = state.bookings.filter(b => parseInt(b.professionalId) === state.currentUser.id);
                title = "Agenda Profesional";
                subtitle = "Pacientes asignados a tu agenda";
            } else {
                // If patient, filter by email
                myBookings = state.bookings.filter(b => b.clientEmail === state.currentUser.email);
            }

            main.innerHTML = `
    <section class="section">
        <div class="container">
            <div class="section-header">
                <h2 class="section-title">${title}</h2>
                <p>${subtitle}</p>
            </div>
            
            <div style="max-width: 900px; margin: 0 auto;">
                ${myBookings.length ? myBookings.map(b => {
                const isProfessional = state.currentUser.role === 'professional';
                const personLabel = isProfessional ? b.clientName : b.professionalName;
                const status = b.status || 'pending'; // Default safe
                const statusClass = status.toLowerCase().replace(/\s/g, '-');

                // Button Logic
                let actions = '';
                if (isProfessional) {
                    if (status === 'confirmed' || status === 'Confirmado') {
                        actions = `
                                <button onclick="turnoApp.registerVisit(${b.id})" class="btn-primary" style="font-size: 0.85rem; padding: 0.5rem;">✅ Completar</button>
                                <button onclick="turnoApp.rescheduleBooking(${b.id})" class="btn-secondary" style="font-size: 0.85rem; padding: 0.5rem;">📅 Reagendar</button>
                            `;
                    } else if (status === 'completed' || status === 'Completado') {
                        actions = `<span class="text-center" style="color: var(--primary); font-size: 0.9rem;">✨ Visita Registrada</span>`;
                    }
                } else {
                    // Patient View Actions
                    if (status === 'confirmed' || status === 'Confirmado') {
                        actions = `<button onclick="alert('Contacta al centro para cancelar.')" class="btn-secondary" style="font-size: 0.8rem; padding: 0.4rem;">Cancelar/Cambiar</button>`;
                    }
                }

                return `
                    <div class="appointment-card status-${statusClass}">
                        <div class="time-column">
                            <span class="time-hour">${b.time}</span>
                            <span class="time-date">${b.date}</span>
                        </div>
                        
                        <div class="info-column">
                            <span class="status-badge ${statusClass}">${status}</span>
                            <h3>${b.serviceName}</h3>
                            <div class="info-meta">
                                <span class="info-item">
                                    <i data-lucide="user" width="16"></i> ${personLabel}
                                </span>
                                ${isProfessional ? `
                                <span class="info-item">
                                    <i data-lucide="mail" width="16"></i> ${b.clientEmail}
                                </span>` : ''}
                            </div>
                        </div>

                        <div class="actions-column">
                            ${actions}
                        </div>
                    </div>
                    `;
            }).join('') : `
                    <div class="text-center" style="padding: 4rem; background: #f9f9f9; border-radius: 8px;">
                        <i data-lucide="calendar-x" width="48" height="48" style="color: #ccc; margin-bottom: 1rem;"></i>
                        <p style="color: #666;">No tienes turnos agendados.</p>
                        <button onclick="turnoApp.navigate('services')" class="btn-primary" style="margin-top: 1rem;">Agendar Nuevo</button>
                    </div>
                `}
            </div>
        </div>
            </section >
    `;
        },

        showConfirmModal(message, onConfirm) {
            const content = `
            <div style="text-align: center; padding: 1rem;">
                <h3 style="margin-bottom: 1rem;">Confirmación</h3>
                <p style="color: #666; margin-bottom: 2rem;">${message}</p>
                <div style="display: flex; gap: 1rem; justify-content: center;">
                    <button onclick="turnoApp.closeModal()" style="padding: 0.5rem 1rem; border: 1px solid #ccc; background: white; border-radius: 4px; cursor: pointer;">Cancelar</button>
                    <button id="confirm-action-btn" class="btn-primary" style="background: #ef4444; border-color: #ef4444;">Confirmar</button>
                </div>
            </div>
        `;
            this.openModal(content);
            document.getElementById('confirm-action-btn').onclick = () => {
                this.closeModal();
                onConfirm();
            };
        },

        renderSettings() {
            const main = document.getElementById('main-content');
            main.innerHTML = `
            <section class="section" style="background:#f8fafc; min-height:80vh;">
                <div class="container" style="max-width: 800px;">
                    <div class="header-action" style="margin-bottom: 2rem;">
                        <h2>Configuración del Sistema</h2>
                        <p style="color: #64748b;">Administra las preferencias generales y visuales de tu clínica.</p>
                    </div>

                    <form id="settings-form" style="background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);" onsubmit="turnoApp.saveSettings(event)">
                        <h3 style="margin-bottom: 1.5rem; color: var(--primary-dark); border-bottom: 2px solid #f1f5f9; padding-bottom: 0.5rem;">Información Institucional</h3>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                            <div class="form-group">
                                <label class="form-label">Nombre de la Clínica / Estudio</label>
                                <input type="text" name="clinicName" class="form-input" value="${state.settings.clinicName}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Email de Contacto</label>
                                <input type="email" name="email" class="form-input" value="${state.settings.email}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Teléfono Público</label>
                                <input type="text" name="phone" class="form-input" value="${state.settings.phone}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Dirección Local</label>
                                <input type="text" name="address" class="form-input" value="${state.settings.address}">
                            </div>
                        </div>

                         <h3 style="margin-top: 2.5rem; margin-bottom: 1.5rem; color: var(--primary-dark); border-bottom: 2px solid #f1f5f9; padding-bottom: 0.5rem;">Preferencias Visuales y Monetarias</h3>
                         
                         <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                             <div class="form-group">
                                <label class="form-label">Moneda Predeterminada</label>
                                <select name="currency" class="form-select">
                                    <option value="ARS" ${state.settings.currency === 'ARS' ? 'selected' : ''}>Pesos Argentinos (ARS)</option>
                                    <option value="USD" ${state.settings.currency === 'USD' ? 'selected' : ''}>Dólares (USD)</option>
                                    <option value="EUR" ${state.settings.currency === 'EUR' ? 'selected' : ''}>Euros (EUR)</option>
                                    <option value="CLP" ${state.settings.currency === 'CLP' ? 'selected' : ''}>Pesos Chilenos (CLP)</option>
                                </select>
                            </div>
                             <div class="form-group">
                                <label class="form-label">Color de Marca (Acento)</label>
                                <div style="display:flex; gap: 1rem; align-items:center;">
                                    <input type="color" name="primaryColor" value="${state.settings.primaryColor}" style="width: 50px; height: 40px; padding:0; border:1px solid #ccc; border-radius:4px; cursor:pointer;" onchange="document.documentElement.style.setProperty('--primary', this.value);">
                                    <span style="font-size:0.8rem; color:#666;">Impacta a botones, calendarios y menús al instante.</span>
                                </div>
                            </div>
                         </div>

                         <hr style="margin: 2.5rem 0; border: 0; border-top: 1px solid #e2e8f0;">
                         
                         <div style="display: flex; justify-content: space-between; align-items: center; padding: 1.5rem; background: #fff1f2; border: 1px dashed #fecdd3; border-radius: 8px;">
                             <div>
                                <h4 style="margin:0; color:#e11d48;">Mantenimiento y Recuperación</h4>
                                <p style="margin:0; font-size:0.85rem; color:#be123c;">Usa esta opción si los usuarios de prueba han perdido los permisos.</p>
                             </div>
                             <button type="button" class="btn-secondary" style="border-color:#e11d48; color:#be123c; background: transparent;" onclick="turnoApp.setupDemoUsers()">Restablecer Usuarios Demo</button>
                         </div>
                         
                         <div style="margin-top: 2rem; text-align: right; display:flex; gap:1rem; justify-content: flex-end;">
                            <button type="submit" class="btn-primary" style="padding-left:2.5rem; padding-right:2.5rem;">Guardar Configuración</button>
                         </div>
                    </form>
                </div>
            </section>
            `;
        },

        saveSettings(event) {
            event.preventDefault();
            const formData = new FormData(event.target);

            state.settings.clinicName = formData.get('clinicName');
            state.settings.email = formData.get('email');
            state.settings.phone = formData.get('phone');
            state.settings.address = formData.get('address');
            state.settings.currency = formData.get('currency');
            state.settings.primaryColor = formData.get('primaryColor');

            localStorage.setItem('lumina_clinic_settings', JSON.stringify(state.settings));

            // Re-apply immediately safely
            document.documentElement.style.setProperty('--primary', state.settings.primaryColor);
            this.updateBranding();

            this.showNotification('Configuración guardada exitosamente.');
            this.renderSidebar(); // refresh sidebar titles if affected by any variable
            this.renderSettings(); // re-render the settings page so inputs match exactly what's saved
        },

        renderInventoryManagement() {
            const main = document.getElementById('main-content');
            const isAdmin = state.currentUser.role === 'admin';

            let html = `
            <section class="section">
                <div class="container">
                    <div class="header-action">
                        <div>
                            <h2>Gestión de Inventario</h2>
                            <p>Control de stock y solicitudes de insumos.</p>
                        </div>
                        ${isAdmin ? '<button onclick="turnoApp.showProductModal()" class="btn-primary">Nuevo Producto</button>' : '<button onclick="turnoApp.showInventoryRequestModal()" class="btn-primary">Pedir Insumos</button>'}
                    </div>
            `;

            if (isAdmin) {
                // Admin View: Products Catalog + Requests
                html += `
                    <h3 style="margin-top:2rem; margin-bottom:1rem;">Catálogo y Stock Actual</h3>
                    <div class="data-table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Producto</th>
                                    <th>Unidad</th>
                                    <th>Disponible</th>
                                    <th>Reservado</th>
                                    <th>Total Físico</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${state.inventoryProducts.map(p => `
                                <tr>
                                    <td><strong>${p.name}</strong><br><small style="color:#666;">${p.description || ''}</small></td>
                                    <td>${p.unit_type}</td>
                                    <td>
                                        <span class="status-badge ${p.stock.available_quantity <= 5 ? 'cancelled' : 'completed'}">
                                            ${p.stock.available_quantity}
                                        </span>
                                    </td>
                                    <td><span style="color:#f59e0b; font-weight:bold;">${p.stock.reserved_quantity}</span></td>
                                    <td style="color:#64748b;">${p.stock.total_quantity}</td>
                                    <td>
                                        <button onclick="turnoApp.showAdjustStockModal('${p.id}')" class="btn-icon" title="Ajustar Stock" style="color:var(--primary);"><i data-lucide="calculator"></i></button>
                                        <button onclick="turnoApp.showProductModal('${p.id}')" class="btn-icon" title="Editar"><i data-lucide="edit"></i></button>
                                    </td>
                                </tr>
                                `).join('')}
                                ${state.inventoryProducts.length === 0 ? '<tr><td colspan="6" class="text-center">No hay productos registrados.</td></tr>' : ''}
                            </tbody>
                        </table>
                    </div>

                    <h3 style="margin-top:3rem; margin-bottom:1rem;">Gestión de Pedidos</h3>
                    <div class="data-table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>ID Pedido</th>
                                    <th>Fecha</th>
                                    <th>Profesional</th>
                                    <th>Detalles (Insumos)</th>
                                    <th>Estado</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${state.inventoryRequests.map(r => `
                                <tr>
                                    <td><small style="color:#94a3b8;">${r.id.split('-')[0]}</small></td>
                                    <td>${new Date(r.created_at).toLocaleDateString()}</td>
                                    <td><strong>${r.profiles?.name || 'N/A'}</strong></td>
                                    <td>
                                        <ul style="margin:0; padding-left:1.2rem; font-size:0.85rem;">
                                            ${r.items?.map(i => `<li>${i.quantity}x ${i.product?.name} (${i.product?.unit_type})</li>`).join('') || 'Sin items'}
                                        </ul>
                                    </td>
                                    <td><span class="status-badge status-${r.status.toLowerCase()}">${r.status}</span></td>
                                    <td style="display:flex; gap:0.5rem; align-items:center;">
                                        ${r.status === 'PENDING' ? `
                                        <button onclick="turnoApp.updateRequestStatus('${r.id}', 'APPROVED')" class="btn-secondary" style="color:#10b981; border-color:#10b981; padding: 4px 8px;">Aprobar</button>
                                        <button onclick="turnoApp.updateRequestStatus('${r.id}', 'REJECTED')" class="btn-secondary" style="color:#ef4444; border-color:#ef4444; padding: 4px 8px;">Rechazar</button>
                                        ` : r.status === 'APPROVED' ? `
                                        <button onclick="turnoApp.updateRequestStatus('${r.id}', 'DELIVERED')" class="btn-primary" style="padding: 4px 8px;">Entregar Físicamente</button>
                                        ` : '-'}
                                    </td>
                                </tr>
                                `).join('')}
                                ${state.inventoryRequests.length === 0 ? '<tr><td colspan="6" class="text-center">No hay pedidos recientes.</td></tr>' : ''}
                            </tbody>
                        </table>
                    </div>
                `;
            } else {
                // Professional View: My Requests
                const myRequests = state.inventoryRequests.filter(r => r.professional_id === state.currentUser.id);
                html += `
                    <h3 style="margin-top:2rem; margin-bottom:1rem;">Mis Solicitudes</h3>
                    <div class="data-table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>ID Pedido</th>
                                    <th>Fecha</th>
                                    <th>Mis Insumos Requeridos</th>
                                    <th>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${myRequests.map(r => `
                                <tr>
                                    <td><small style="color:#94a3b8;">${r.id.split('-')[0]}</small></td>
                                    <td>${new Date(r.created_at).toLocaleDateString()}</td>
                                    <td>
                                        <ul style="margin:0; padding-left:1.2rem; font-size:0.85rem;">
                                            ${r.items?.map(i => `<li>${i.quantity}x ${i.product?.name} (${i.product?.unit_type})</li>`).join('') || 'Sin items'}
                                        </ul>
                                    </td>
                                    <td><span class="status-badge status-${r.status.toLowerCase()}">${r.status}</span></td>
                                </tr>
                                `).join('')}
                                ${myRequests.length === 0 ? '<tr><td colspan="4" class="text-center">No has emitido pedidos aún.</td></tr>' : ''}
                            </tbody>
                        </table>
                    </div>
                `;
            }

            html += `
                </div>
            </section>
            `;
            main.innerHTML = html;
            this.updateIcons();
        },

        // --- INVENTORY LOGIC (V2 RPC BACKED) ---
        showProductModal(productId = null) {
            const product = productId ? state.inventoryProducts.find(p => p.id === productId) : null;
            const content = `
                <div class="modal-header">
                    <h3>${product ? 'Editar Producto' : 'Nuevo Producto / Base'}</h3>
                    <button onclick="turnoApp.closeModal()" class="btn-icon">✖</button>
                </div>
                <div class="modal-tab-content">
                    <form onsubmit="turnoApp.saveProduct(event, ${product ? `'${product.id}'` : null})">
                        <div class="form-group">
                            <label class="form-label">Nombre Comercial</label>
                            <input type="text" name="name" class="form-input" required value="${product ? product.name : ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Descripción</label>
                            <input type="text" name="description" class="form-input" value="${product ? (product.description || '') : ''}">
                        </div>
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
                            <div class="form-group">
                                <label class="form-label">Tipo de Unidad</label>
                                <select name="unit_type" class="form-select" required>
                                    <option value="unit" ${product && product.unit_type === 'unit' ? 'selected' : ''}>Unidad(es)</option>
                                    <option value="vial" ${product && product.unit_type === 'vial' ? 'selected' : ''}>Ampolla / Vial</option>
                                    <option value="ml" ${product && product.unit_type === 'ml' ? 'selected' : ''}>Mililitros (ml)</option>
                                    <option value="box" ${product && product.unit_type === 'box' ? 'selected' : ''}>Caja(s)</option>
                                </select>
                            </div>
                        </div>
                        
                        <div style="margin-top:2rem; display:flex; justify-content:flex-end;">
                            <button type="submit" class="btn-primary">Guardar Catálogo</button>
                        </div>
                    </form>
                </div>
            `;
            this.openModal(content);
        },

        async saveProduct(event, productId) {
            event.preventDefault();
            const form = event.target;
            const payload = {
                name: form.name.value,
                description: form.description.value,
                unit_type: form.unit_type.value
            };

            this.showNotification('Procesando...');

            if (productId) {
                await supabase.from('products').update(payload).eq('id', productId);
            } else {
                await supabase.from('products').insert([payload]);
            }

            this.closeModal();
            await this.fetchInventoryProducts();
            this.renderInventoryManagement();
            this.showNotification('Catálogo actualizado.');
        },

        showAdjustStockModal(productId) {
            const product = state.inventoryProducts.find(p => p.id === productId);
            const content = `
                <div class="modal-header">
                    <h3>Operación Manual de Stock</h3>
                    <button onclick="turnoApp.closeModal()" class="btn-icon">✖</button>
                </div>
                <div style="padding:1rem;">
                    <p style="margin-bottom:1rem; border-left: 3px solid #3b82f6; padding-left:0.8rem; background:#eff6ff; padding: 0.8rem; border-radius:4px;">
                        Estás ajustando directamente el stock de <strong>${product.name}</strong>. Esta operación generará un log transaccional inmutable.
                    </p>
                    <form onsubmit="turnoApp.saveStockAdjustment(event, '${productId}')">
                        <div style="display:grid; grid-template-columns: 1fr 2fr; gap:1rem;">
                            <div class="form-group">
                                <label class="form-label">Unidades (Ej: 10, -3)</label>
                                <input type="number" name="adj_quantity" class="form-input" required placeholder="Ej: 5 o -2">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Causa (Audit Log)</label>
                                <input type="text" name="reason" class="form-input" required placeholder="Ej: Vencimiento, Proveedor, Merma...">
                            </div>
                        </div>
                        <div style="margin-top:1.5rem; text-align:right;">
                            <button type="submit" class="btn-primary" style="background:#0f172a; border-color:#0f172a;">Ejecutar Bloqueo y Guardar</button>
                        </div>
                    </form>
                </div>
            `;
            this.openModal(content);
        },

        async saveStockAdjustment(event, productId) {
            event.preventDefault();
            const qty = parseInt(event.target.adj_quantity.value);
            const reason = event.target.reason.value;

            if (qty === 0) return this.closeModal();

            this.showNotification('Iniciando transacción segura...');

            // 1. Invocar RPC para asegurar ACID y concurrencia for update
            const { error: rpcError } = await supabase.rpc('rpc_inventory_adjust_stock', {
                p_product_id: productId,
                p_quantity: qty,
                p_reason: reason,
                p_user_id: state.currentUser.id
            });

            if (!rpcError) {
                await this.fetchInventoryProducts();
                this.renderInventoryManagement();
                this.closeModal();
                this.showNotification('Transacción exitosa. Stock comprometido.');
            } else {
                console.error(rpcError);
                alert('La transacción fue abortada: Ocurrió un conflicto de bloqueo negativo o el stock no daría abasto.');
            }
        },

        showInventoryRequestModal() {
            const content = `
                <div class="modal-header">
                    <h3>Levantar Pedido Interno</h3>
                    <button onclick="turnoApp.closeModal()" class="btn-icon">✖</button>
                </div>
                <div class="modal-tab-content">
                    <form onsubmit="turnoApp.saveInventoryRequest(event)">
                        <div class="form-group">
                            <label class="form-label">Insumo Requerido (De momento sólo 1 item por pedido para simplificar UI)</label>
                            <select name="product_id" class="form-select" required>
                                ${state.inventoryProducts.map(p => `<option value="${p.id}">${p.name} (Stock Display: ${p.stock.available_quantity} ${p.unit_type})</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Cantidad a Solicitar</label>
                            <input type="number" name="quantity" class="form-input" required value="1" min="1">
                        </div>
                        
                        <div style="margin-top:2rem; text-align:right;">
                            <button type="submit" class="btn-primary">Generar Orden</button>
                        </div>
                    </form>
                </div>
            `;
            this.openModal(content);
        },

        async saveInventoryRequest(event) {
            event.preventDefault();
            const product_id = event.target.product_id.value;
            const qty = parseInt(event.target.quantity.value);

            this.showNotification('Procesando Orden...');

            // Inserción dual: orders headers y orders items
            const { data: order, error: orderErr } = await supabase.from('inventory_orders')
                .insert([{ professional_id: state.currentUser.id, status: 'PENDING' }])
                .select().single();

            if (!orderErr && order) {
                const { error: itemErr } = await supabase.from('inventory_order_items')
                    .insert([{ order_id: order.id, product_id: product_id, quantity: qty }]);

                if (!itemErr) {
                    await this.fetchInventoryRequests();
                    this.renderInventoryManagement();
                    this.closeModal();
                    this.showNotification('Orden generada correctamente.');
                    return;
                }
            }
            alert('Fallo registrando en base.');
        },

        async updateRequestStatus(reqId, newStatus) {
            const req = state.inventoryRequests.find(r => r.id === reqId);
            if (!req) return;

            this.showNotification('Ejecutando lógica de estado transaccional...');

            if (newStatus === 'APPROVED') {
                // Mueve available -> reserved (RPC locking)
                const { error } = await supabase.rpc('rpc_inventory_approve_order', {
                    p_order_id: reqId,
                    p_user_id: state.currentUser.id
                });
                if (error) { console.error(error); return alert('Error procesando reservas. Probablemente stock insuficiente durante el bloqueo pesimista.'); }

            } else if (newStatus === 'DELIVERED') {
                // Saca de reserved y efectúa el OUT (RPC locking)
                const { error } = await supabase.rpc('rpc_inventory_deliver_order', {
                    p_order_id: reqId,
                    p_user_id: state.currentUser.id
                });
                if (error) { console.error(error); return alert('Error al registrar la entrega.'); }

            } else if (newStatus === 'REJECTED') {
                // Rechazo simple (No implica blocks masIVOS)
                await supabase.from('inventory_orders').update({ status: 'REJECTED' }).eq('id', reqId);
            }

            await this.fetchInventoryProducts();
            await this.fetchInventoryRequests();
            this.renderInventoryManagement();
            this.showNotification('Orden procesada sistémicamente bajo patrón ACID.');
        },

        cancelBooking(id) {
            this.showConfirmModal('¿Estás seguro de que deseas cancelar este turno? Esta acción no se puede deshacer.', () => {
                const booking = state.bookings.find(b => b.id === id);
                if (booking) {
                    booking.status = 'Cancelado';
                    localStorage.setItem('lumina_bookings', JSON.stringify(state.bookings));
                    this.showNotification('Turno cancelado');
                    this.renderMyBookings();
                }
            });
        },

        // ENH-19: Reschedule
        rescheduleBooking(id) {
            const booking = state.bookings.find(b => b.id === id);
            if (!booking) return;
            state.rescheduleId = id;
            this.startBooking(booking.serviceId); // Navigate to booking with service pre-selected
        },

        editBooking(id) {
            const booking = state.bookings.find(b => b.id === id);
            if (!booking) return;

            const isReadOnly = booking.status === 'Completado' || booking.status === 'Cancelado';

            const professionalsList = state.professionals.map(p => `<option value="${p.id}" ${p.id == booking.professionalId ? 'selected' : ''}>${p.name}</option>`).join('');
            const servicesList = state.services.map(s => `<option value="${s.id}" ${s.id == booking.serviceId ? 'selected' : ''}>${s.name}</option>`).join('');

            const statusOptions = ['Pendiente', 'Confirmado', 'Completado', 'Cancelado'].map(s => {
                let disabled = false;
                let label = s;
                if (booking.status === 'Confirmado' && s === 'Pendiente') {
                    disabled = true;
                    label += ' (inválido)';
                }
                return `<option value="${s}" ${booking.status === s ? 'selected' : ''} ${disabled ? 'disabled' : ''}>${label}</option>`;
            }).join('');

            const content = `
            <div class="modal-header">
                <h3>Editar Reserva</h3>
                <p style="color: #666; font-size: 0.9rem;">${booking.clientName}</p>
            </div>
            ${isReadOnly ? `
                <div style="background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 0.75rem; border-radius: 6px; margin-bottom: 1rem; font-size: 0.9rem;">
                    ⚠️ Este turno ya fue ${booking.status.toLowerCase()} y no puede modificarse.
                </div>
            ` : ''}
            <form id="edit-booking-form" onsubmit="turnoApp.updateBooking(event, ${id})">
                 <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group">
                        <label class="form-label">Fecha</label>
                        <input type="date" name="date" class="form-input" value="${booking.date}" required ${isReadOnly ? 'disabled' : ''}>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Hora</label>
                        <input type="time" name="time" class="form-input" value="${booking.time}" required ${isReadOnly ? 'disabled' : ''}>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Profesional</label>
                    <select name="professionalId" class="form-select" required ${isReadOnly ? 'disabled' : ''}>
                        ${professionalsList}
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">Servicio</label>
                    <div style="display: flex; gap: 1rem; align-items: center;">
                        <select name="serviceId" class="form-select" required style="flex: 1;" ${isReadOnly ? 'disabled' : ''} onchange="turnoApp.onServiceChangeInEditModal(this.value)">
                            ${servicesList}
                        </select>
                        <span id="edit-service-duration" style="font-size: 0.9rem; color: #64748b; font-weight: 500; white-space: nowrap;">Duración: ${booking.duration || (state.services.find(s => s.id === booking.serviceId)?.duration || 0)} min</span>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group">
                        <label class="form-label">Método de pago</label>
                        <select name="paymentMethod" class="form-select" required ${isReadOnly ? 'disabled' : ''}>
                            <option value="A confirmar" ${booking.paymentMethod === 'A confirmar' ? 'selected' : ''}>A confirmar</option>
                            <option value="Efectivo" ${booking.paymentMethod === 'Efectivo' ? 'selected' : ''}>Efectivo</option>
                            <option value="Tarjeta" ${booking.paymentMethod === 'Tarjeta' ? 'selected' : ''}>Tarjeta</option>
                            <option value="Transferencia" ${booking.paymentMethod === 'Transferencia' ? 'selected' : ''}>Transferencia</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Monto</label>
                        <input type="number" name="price" id="edit-booking-price" class="form-input" required value="${booking.price !== undefined ? booking.price : (state.services.find(s => s.id === booking.serviceId)?.price || 0)}" ${isReadOnly ? 'disabled' : ''}>
                    </div>
                </div>

                 <div class="form-group">
                    <label class="form-label">Estado</label>
                    <select name="status" class="form-select" ${isReadOnly ? 'disabled' : ''}>
                        ${statusOptions}
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">Notas</label>
                    <textarea name="notes" class="form-input" rows="2" ${isReadOnly ? 'disabled' : ''}>${booking.notes || ''}</textarea>
                </div>

                <div style="display: flex; gap: 1rem; margin-top: 1.5rem; justify-content: space-between;">
                    ${!isReadOnly ? `<button type="button" onclick="turnoApp.closeModal(); turnoApp.cancelBooking(${id})" style="color: #ef4444; background: none; border: none; font-weight: 500; cursor: pointer;">Cancelar Turno</button>` : `<div></div>`}
                    <div style="display: flex; gap: 0.5rem;">
                        <button type="button" onclick="turnoApp.closeModal()" class="btn-secondary">Cerrar</button>
                        ${!isReadOnly ? `<button type="submit" class="btn-primary">Guardar Cambios</button>` : ''}
                    </div>
                </div>
            </form>
            `;
            this.openModal(content);
        },

        onServiceChangeInEditModal(serviceId) {
            const service = state.services.find(s => s.id == serviceId);
            if (service) {
                const durEl = document.getElementById('edit-service-duration');
                const priceEl = document.getElementById('edit-booking-price');
                if (durEl) durEl.innerText = `Duración: ${service.duration || 0} min`;
                if (priceEl) priceEl.value = service.price || 0;
            }
        },

        updateBooking(e, id) {
            e.preventDefault();
            const formData = new FormData(e.target);
            const booking = state.bookings.find(b => b.id === id);

            if (booking) {
                booking.date = formData.get('date');
                booking.time = formData.get('time');
                booking.status = formData.get('status');
                booking.notes = formData.get('notes');
                booking.paymentMethod = formData.get('paymentMethod');
                booking.price = parseFloat(formData.get('price')) || 0;

                // Update relations if changed (simplified)
                const newProfId = parseInt(formData.get('professionalId'));
                if (newProfId !== booking.professionalId) {
                    booking.professionalId = newProfId;
                    const prof = state.professionals.find(p => p.id === newProfId);
                    booking.professionalName = prof ? prof.name : 'Unknown';
                }

                const newServiceId = parseInt(formData.get('serviceId'));
                if (newServiceId !== booking.serviceId) {
                    booking.serviceId = newServiceId;
                    const srv = state.services.find(s => s.id === newServiceId);
                    booking.serviceName = srv ? srv.name : 'Unknown';
                    booking.duration = srv ? srv.duration : 30;
                }

                localStorage.setItem('lumina_bookings', JSON.stringify(state.bookings));

                this.showNotification('Reserva actualizada correctamente', 'top-right');

                if (booking.status === 'Completado' || booking.status === 'Cancelado') {
                    this.editBooking(id);
                } else {
                    this.closeModal();
                }

                this.renderAdmin();
            }
        },

        getServiceColor(serviceId) {
            // Helper to color code bookings by service
            const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
            return colors[serviceId % colors.length] || '#64748b';
        },

        getProfColor(profId) {
            const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444', '#14b8a6', '#f43f5e', '#84cc16', '#6366f1'];
            let hash = 0;
            if (profId) hash = parseInt(profId);
            return colors[hash % colors.length] || '#64748b';
        },

        getAdminWeekHTML() {
            const currentDate = state.agendaView.selectedDay ? new Date(state.agendaView.selectedDay) : new Date();
            const dayOfWeek = currentDate.getDay();
            const diff = currentDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
            const startOfWeek = new Date(currentDate.setDate(diff));
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);

            const startStr = startOfWeek.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
            const endStr = endOfWeek.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

            const startHour = 6;
            const endHour = 23;
            const pixelsPerMinute = 2; // 1 min = 2px
            const slotHeight = 60; // 30 mins = 60px

            // Build Header
            let headerHTML = '<div class="timetable-header-grid"><div class="timetable-time-axis-header"></div>';
            const days = [];
            for (let i = 0; i < 7; i++) {
                const dayDate = new Date(startOfWeek);
                dayDate.setDate(startOfWeek.getDate() + i);
                const dateStr = dayDate.toISOString().split('T')[0];
                const dayName = dayDate.toLocaleDateString('es-ES', { weekday: 'short' });
                const dayNum = dayDate.getDate();
                const isToday = new Date().toISOString().split('T')[0] === dateStr;

                days.push({ dateStr, dayDate, isToday });
                headerHTML += `<div class="timetable-day-header ${isToday ? 'today' : ''}" style="cursor: pointer;" onclick="turnoApp.changeWeekDay('${dateStr}')">
                    <div style="text-transform: capitalize; font-size: 0.85rem;">${dayName}</div>
                    <div style="font-size: 1.2rem;">${dayNum}</div>
                </div>`;
            }
            headerHTML += '</div>';

            // Build Time Axis
            let timeAxisHTML = '<div class="timetable-time-axis">';
            for (let h = startHour; h <= endHour; h++) {
                const label = `${h.toString().padStart(2, '0')}:00`;
                timeAxisHTML += `<div class="time-label-slot" style="height: ${slotHeight * 2}px;"><span>${label}</span></div>`;
            }
            timeAxisHTML += '</div>';

            // Build Columns
            let columnsHTML = '';
            for (let day of days) {
                const dayBookings = state.bookings.filter(b =>
                    b.date === day.dateStr &&
                    b.status !== 'Cancelado' &&
                    (!state.adminFilters.professionalId || b.professionalId == state.adminFilters.professionalId)
                );

                dayBookings.sort((a, b) => a.time.localeCompare(b.time));
                const groups = [];
                for (let b of dayBookings) {
                    const parts = b.time.split(':');
                    const startMin = parseInt(parts[0]) * 60 + parseInt(parts[1]);
                    const endMin = startMin + (b.duration || 30);
                    b.startMin = startMin;
                    b.endMin = endMin;

                    let placed = false;
                    for (let g of groups) {
                        if (g.some(gb => Math.max(startMin, gb.startMin) < Math.min(endMin, gb.endMin))) {
                            g.push(b);
                            placed = true;
                            break;
                        }
                    }
                    if (!placed) {
                        groups.push([b]);
                    }
                }

                for (let g of groups) {
                    const count = g.length;
                    g.forEach((b, index) => {
                        b.widthPct = 98 / count;
                        b.leftPct = (100 / count) * index;
                    });
                }

                let slotsHTML = '';
                for (let h = startHour; h <= endHour; h++) {
                    const t1 = `${h.toString().padStart(2, '0')}:00`;
                    const t2 = `${h.toString().padStart(2, '0')}:30`;
                    slotsHTML += `<div class="time-slot" style="height: ${slotHeight}px;" onclick="turnoApp.showAdminBookingModal('${day.dateStr}', '${t1}')"></div>`;
                    slotsHTML += `<div class="time-slot" style="height: ${slotHeight}px;" onclick="turnoApp.showAdminBookingModal('${day.dateStr}', '${t2}')"></div>`;
                }

                let bookingsHTML = '';
                for (let b of dayBookings) {
                    const startOffset = (b.startMin - (startHour * 60)) * pixelsPerMinute;
                    const bHeight = (b.duration || 30) * pixelsPerMinute - 2;
                    if (startOffset < 0) continue;

                    bookingsHTML += `
                    <div class="booking-block" 
                         onclick="event.stopPropagation(); turnoApp.editBooking(${b.id})"
                         style="top: ${startOffset}px; height: ${bHeight}px; left: ${b.leftPct}%; width: ${b.widthPct}%; background: ${turnoApp.getProfColor(b.professionalId)};">
                        <div class="booking-title">${b.time} ${b.clientName.split(' ')[0]}</div>
                        <div class="booking-subtitle">${b.serviceName}</div>
                    </div>`;
                }

                let currentTimeHTML = '';
                if (day.isToday) {
                    const now = new Date();
                    const nowMin = now.getHours() * 60 + now.getMinutes();
                    if (nowMin >= startHour * 60 && nowMin <= (endHour + 1) * 60) {
                        const topOffset = (nowMin - (startHour * 60)) * pixelsPerMinute;
                        currentTimeHTML = `<div class="current-time-line" style="top: ${topOffset}px;"><div class="current-time-indicator"></div></div>`;
                    }
                }

                columnsHTML += `<div class="timetable-day-column ${day.isToday ? 'today' : ''}">
                    ${slotsHTML}
                    ${bookingsHTML}
                    ${currentTimeHTML}
                </div>`;
            }

            let weekGrid = `
            <div class="timetable-container" id="week-timetable-scroll">
                ${headerHTML}
                <div class="timetable-body">
                    ${timeAxisHTML}
                    ${columnsHTML}
                </div>
            </div>`;

            requestAnimationFrame(() => {
                const scrollEl = document.getElementById('week-timetable-scroll');
                if (scrollEl) {
                    const now = new Date();
                    const currentMin = now.getHours() * 60 + now.getMinutes();
                    let targetScroll = 240;
                    if (currentMin >= 360 && currentMin <= 1380) {
                        targetScroll = (currentMin - 360) * 2 - 40;
                    }
                    scrollEl.scrollTop = Math.max(0, targetScroll);
                }
            });

            return `
                    <div class="calendar-container">
                        <div class="calendar-header" style="margin-bottom: 1rem;">
                             <button onclick="turnoApp.changeWeek(-1)" class="btn-icon">←</button>
                             <h3 style="margin: 0; display: flex; align-items: center;">Semana ${startStr} - ${endStr}</h3>
                             <button onclick="turnoApp.changeWeek(1)" class="btn-icon">→</button>
                        </div>
                        ${weekGrid}
                    </div>`;
        },

        changeWeekDay(dateStr) {
            state.agendaView.selectedDay = new Date(dateStr + "T12:00:00");
            this.setAdminViewMode('day');
        },

        getAdminDayHTML() {
            const dateStr = state.agendaView.selectedDay ? new Date(state.agendaView.selectedDay).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
            const dateObj = new Date(dateStr + "T12:00:00");
            const prettyDate = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

            const startHour = 6;
            const endHour = 23;
            const pixelsPerMinute = 2; // 1 min = 2px
            const slotHeight = 60; // 30 mins = 60px

            let headerHTML = `<div class="timetable-header-grid"><div class="timetable-time-axis-header"></div>
                <div class="timetable-day-header today" style="text-transform: capitalize; font-size: 1.1rem;">${prettyDate}</div>
            </div>`;

            let timeAxisHTML = '<div class="timetable-time-axis">';
            for (let h = startHour; h <= endHour; h++) {
                const label = `${h.toString().padStart(2, '0')}:00`;
                timeAxisHTML += `<div class="time-label-slot" style="height: ${slotHeight * 2}px;"><span>${label}</span></div>`;
            }
            timeAxisHTML += '</div>';

            const dayBookings = state.bookings.filter(b =>
                b.date === dateStr &&
                b.status !== 'Cancelado' &&
                (!state.adminFilters.professionalId || b.professionalId == state.adminFilters.professionalId)
            );

            dayBookings.sort((a, b) => a.time.localeCompare(b.time));
            const groups = [];
            for (let b of dayBookings) {
                const parts = b.time.split(':');
                const startMin = parseInt(parts[0]) * 60 + parseInt(parts[1]);
                const endMin = startMin + (b.duration || 30);
                b.startMin = startMin;
                b.endMin = endMin;
                let placed = false;
                for (let g of groups) {
                    if (g.some(gb => Math.max(startMin, gb.startMin) < Math.min(endMin, gb.endMin))) {
                        g.push(b);
                        placed = true; break;
                    }
                }
                if (!placed) groups.push([b]);
            }
            for (let g of groups) {
                const count = g.length;
                g.forEach((b, index) => {
                    b.widthPct = 98 / count;
                    b.leftPct = (100 / count) * index;
                });
            }

            let slotsHTML = '';
            for (let h = startHour; h <= endHour; h++) {
                const t1 = `${h.toString().padStart(2, '0')}:00`;
                const t2 = `${h.toString().padStart(2, '0')}:30`;
                slotsHTML += `<div class="time-slot" style="height: ${slotHeight}px;" onclick="turnoApp.showAdminBookingModal('${dateStr}', '${t1}')"></div>`;
                slotsHTML += `<div class="time-slot" style="height: ${slotHeight}px;" onclick="turnoApp.showAdminBookingModal('${dateStr}', '${t2}')"></div>`;
            }

            let bookingsHTML = '';
            for (let b of dayBookings) {
                const startOffset = (b.startMin - (startHour * 60)) * pixelsPerMinute;
                const bHeight = (b.duration || 30) * pixelsPerMinute - 2;
                if (startOffset < 0) continue;

                bookingsHTML += `
                <div class="booking-block" 
                     onclick="event.stopPropagation(); turnoApp.editBooking(${b.id})"
                     style="top: ${startOffset}px; height: ${bHeight}px; left: ${b.leftPct}%; width: ${b.widthPct}%; background: ${turnoApp.getProfColor(b.professionalId)}; padding: 6px;">
                    <div class="booking-title" style="font-size: 0.9rem;">${b.time} ${b.clientName}</div>
                    <div class="booking-subtitle" style="font-size: 0.75rem;">${b.serviceName}</div>
                </div>`;
            }

            let currentTimeHTML = '';
            const isToday = new Date().toISOString().split('T')[0] === dateStr;
            if (isToday) {
                const now = new Date();
                const nowMin = now.getHours() * 60 + now.getMinutes();
                if (nowMin >= startHour * 60 && nowMin <= (endHour + 1) * 60) {
                    const topOffset = (nowMin - (startHour * 60)) * pixelsPerMinute;
                    currentTimeHTML = `<div class="current-time-line" style="top: ${topOffset}px;"><div class="current-time-indicator"></div></div>`;
                }
            }

            let columnsHTML = `<div class="timetable-day-column today">
                ${slotsHTML}
                ${bookingsHTML}
                ${currentTimeHTML}
            </div>`;

            let dayGrid = `
            <div class="timetable-container" id="day-timetable-scroll">
                ${headerHTML}
                <div class="timetable-body">
                    ${timeAxisHTML}
                    ${columnsHTML}
                </div>
            </div>`;

            requestAnimationFrame(() => {
                const scrollEl = document.getElementById('day-timetable-scroll');
                if (scrollEl) {
                    const now = new Date();
                    const currentMin = now.getHours() * 60 + now.getMinutes();
                    let targetScroll = 240;
                    if (currentMin >= 360 && currentMin <= 1380) {
                        targetScroll = (currentMin - 360) * 2 - 40;
                    }
                    scrollEl.scrollTop = Math.max(0, targetScroll);
                }
            });

            return `
            <div class="calendar-container">
                <div class="calendar-header" style="margin-bottom: 1rem;">
                     <button onclick="turnoApp.changeDay(-1)" class="btn-icon">←</button>
                     <h3 style="margin: 0; display: flex; align-items: center;">${prettyDate}</h3>
                     <button onclick="turnoApp.changeDay(1)" class="btn-icon">→</button>
                </div>
                ${dayGrid}
            </div>`;
        },

    };

    // Start App
    document.addEventListener('DOMContentLoaded', () => turnoApp.init());

    // Expose to window for HTML onclick handlers
    window.turnoApp = turnoApp;
})();
