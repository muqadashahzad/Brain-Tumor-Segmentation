/**
 * Simple Client-Side Router
 * Handles navigation between different sections of the application
 */

class SimpleRouter {
    constructor() {
        this.routes = new Map();
        this.currentRoute = null;
        this.init();
    }

    init() {
        // Handle browser back/forward buttons
        window.addEventListener('popstate', (e) => {
            this.handleRoute(window.location.pathname);
        });

        // Handle initial route
        this.handleRoute(window.location.pathname);
    }

    // Register a route
    addRoute(path, handler) {
        this.routes.set(path, handler);
    }

    // Navigate to a route
    navigate(path, pushState = true) {
        if (pushState) {
            history.pushState(null, '', path);
        }
        this.handleRoute(path);
    }

    // Handle route changes
    handleRoute(path) {
        this.currentRoute = path;
        
        // Check if user is authenticated for protected routes
        if (this.isProtectedRoute(path) && !this.isAuthenticated()) {
            this.navigate('/login', false);
            return;
        }

        // Check if authenticated user is trying to access auth pages
        if (this.isAuthRoute(path) && this.isAuthenticated()) {
            this.navigate('/dashboard', false);
            return;
        }

        // Execute route handler
        const handler = this.routes.get(path);
        if (handler) {
            handler();
        } else {
            // Default route handling
            this.handleDefaultRoute(path);
        }
    }

    // Check if route requires authentication
    isProtectedRoute(path) {
        const protectedRoutes = ['/dashboard', '/profile', '/settings'];
        return protectedRoutes.includes(path);
    }

    // Check if route is an authentication page
    isAuthRoute(path) {
        const authRoutes = ['/login', '/register'];
        return authRoutes.includes(path);
    }

    // Check if user is authenticated
    isAuthenticated() {
        return localStorage.getItem('authToken') !== null;
    }

    // Handle default/unknown routes
    handleDefaultRoute(path) {
        if (path === '/' || path === '') {
            // Redirect based on authentication status
            if (this.isAuthenticated()) {
                this.navigate('/dashboard', false);
            } else {
                // Show main landing page or redirect to login
                window.location.href = '/';
            }
        } else {
            // Unknown route - redirect to appropriate default
            if (this.isAuthenticated()) {
                this.navigate('/dashboard', false);
            } else {
                this.navigate('/login', false);
            }
        }
    }

    // Get current route
    getCurrentRoute() {
        return this.currentRoute;
    }
}

// Navigation Helper Functions
class NavigationHelper {
    constructor(router) {
        this.router = router;
        this.setupNavigationListeners();
    }

    setupNavigationListeners() {
        // Handle all navigation links
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[data-route]');
            if (link) {
                e.preventDefault();
                const route = link.getAttribute('data-route');
                this.router.navigate(route);
            }
        });

        // Handle form submissions that should navigate
        document.addEventListener('submit', (e) => {
            const form = e.target.closest('form[data-route]');
            if (form) {
                e.preventDefault();
                const route = form.getAttribute('data-route');
                this.router.navigate(route);
            }
        });
    }

    // Update active navigation items
    updateActiveNavigation(currentPath) {
        document.querySelectorAll('.nav-link, .navbar-nav a').forEach(link => {
            link.classList.remove('active');
            
            const href = link.getAttribute('href');
            if (href === currentPath || 
                (href && href.startsWith('#') && currentPath.includes(href.substring(1)))) {
                link.classList.add('active');
            }
        });
    }

    // Show/hide navigation based on authentication
    updateNavigationVisibility() {
        const isAuthenticated = this.router.isAuthenticated();
        
        // Show/hide authenticated navigation
        const authNavItems = document.querySelectorAll('.nav-auth-required');
        authNavItems.forEach(item => {
            item.style.display = isAuthenticated ? 'block' : 'none';
        });

        // Show/hide guest navigation
        const guestNavItems = document.querySelectorAll('.nav-guest-only');
        guestNavItems.forEach(item => {
            item.style.display = isAuthenticated ? 'none' : 'block';
        });
    }
}

// Page Transition Effects
class PageTransitions {
    constructor() {
        this.transitionDuration = 300;
    }

    // Fade transition between pages
    fadeTransition(outElement, inElement, callback) {
        if (outElement) {
            outElement.style.transition = `opacity ${this.transitionDuration}ms ease`;
            outElement.style.opacity = '0';
            
            setTimeout(() => {
                outElement.style.display = 'none';
                if (callback) callback();
            }, this.transitionDuration);
        } else {
            if (callback) callback();
        }

        if (inElement) {
            setTimeout(() => {
                inElement.style.display = 'block';
                inElement.style.opacity = '0';
                inElement.style.transition = `opacity ${this.transitionDuration}ms ease`;
                
                // Force reflow
                inElement.offsetHeight;
                
                inElement.style.opacity = '1';
            }, outElement ? this.transitionDuration : 0);
        }
    }

    // Slide transition
    slideTransition(outElement, inElement, direction = 'left') {
        const slideDistance = direction === 'left' ? '-100%' : '100%';
        
        if (outElement) {
            outElement.style.transition = `transform ${this.transitionDuration}ms ease`;
            outElement.style.transform = `translateX(${slideDistance})`;
            
            setTimeout(() => {
                outElement.style.display = 'none';
                outElement.style.transform = 'translateX(0)';
            }, this.transitionDuration);
        }

        if (inElement) {
            setTimeout(() => {
                inElement.style.display = 'block';
                inElement.style.transform = `translateX(${direction === 'left' ? '100%' : '-100%'})`;
                inElement.style.transition = `transform ${this.transitionDuration}ms ease`;
                
                // Force reflow
                inElement.offsetHeight;
                
                inElement.style.transform = 'translateX(0)';
            }, outElement ? this.transitionDuration / 2 : 0);
        }
    }
}

// Authentication State Manager
class AuthStateManager {
    constructor(router) {
        this.router = router;
        this.user = null;
        this.init();
    }

    init() {
        this.loadUserFromStorage();
        this.setupAuthListeners();
    }

    loadUserFromStorage() {
        const token = localStorage.getItem('authToken');
        const userData = localStorage.getItem('userData');
        
        if (token && userData) {
            try {
                this.user = JSON.parse(userData);
                this.updateUIForAuthenticatedUser();
            } catch (e) {
                console.error('Error parsing user data:', e);
                this.logout();
            }
        }
    }

    login(userData, token) {
        this.user = userData;
        localStorage.setItem('authToken', token);
        localStorage.setItem('userData', JSON.stringify(userData));
        this.updateUIForAuthenticatedUser();
    }

    logout() {
        this.user = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
        this.updateUIForGuestUser();
        this.router.navigate('/login');
    }

    updateUIForAuthenticatedUser() {
        // Update user display elements
        const userNameElements = document.querySelectorAll('[data-user-name]');
        userNameElements.forEach(element => {
            if (this.user) {
                element.textContent = `${this.user.firstName} ${this.user.lastName}`;
            }
        });

        // Show/hide navigation elements
        document.querySelectorAll('.auth-required').forEach(el => {
            el.style.display = 'block';
        });
        
        document.querySelectorAll('.guest-only').forEach(el => {
            el.style.display = 'none';
        });
    }

    updateUIForGuestUser() {
        // Hide authenticated elements
        document.querySelectorAll('.auth-required').forEach(el => {
            el.style.display = 'none';
        });
        
        // Show guest elements
        document.querySelectorAll('.guest-only').forEach(el => {
            el.style.display = 'block';
        });
    }

    setupAuthListeners() {
        // Listen for logout events
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-logout]')) {
                e.preventDefault();
                this.logout();
            }
        });
    }

    getUser() {
        return this.user;
    }

    isAuthenticated() {
        return this.user !== null && localStorage.getItem('authToken') !== null;
    }
}

// Initialize router when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Create router instance
    const router = new SimpleRouter();
    
    // Create helper instances
    const navigation = new NavigationHelper(router);
    const transitions = new PageTransitions();
    const authState = new AuthStateManager(router);
    
    // Make available globally
    window.router = router;
    window.navigation = navigation;
    window.transitions = transitions;
    window.authState = authState;
    
    // Setup route handlers
    router.addRoute('/login', () => {
        console.log('Navigating to login page');
    });
    
    router.addRoute('/register', () => {
        console.log('Navigating to register page');
    });
    
    router.addRoute('/dashboard', () => {
        console.log('Navigating to dashboard');
    });
    
    router.addRoute('/', () => {
        console.log('Navigating to home page');
    });
});

// Export classes for external use
window.SimpleRouter = SimpleRouter;
window.NavigationHelper = NavigationHelper;
window.PageTransitions = PageTransitions;
window.AuthStateManager = AuthStateManager;
