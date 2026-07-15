// --- CONFIGURACIÓN DE WHATSAPP ---
// Reemplaza por tu número real (incluye código de país, sin el símbolo +)
const WHATSAPP_NUMBER = "573174271275"; 

// 1. SISTEMA DE USUARIO (LocalStorage)
let userProfile = JSON.parse(localStorage.getItem('tridiUser')) || {
    name: null,
    likes: [],     // IDs de productos
    recent: [],    // IDs de productos vistos
    orders: []     // IDs de productos pedidos
};

function saveUser() {
    localStorage.setItem('tridiUser', JSON.stringify(userProfile));
}

// 2. BASE DE DATOS DE PRODUCTOS (cargada desde data/products.json para poder
// editarla con un CMS Git-based sin tocar este archivo)
let productsDB = [];
let productsLoadError = null;

async function loadProductsDB() {
    try {
        const response = await fetch('data/products.json');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        productsDB = data.products;
    } catch (err) {
        console.error('No se pudo cargar data/products.json:', err);
        productsLoadError = err;
    }
}

// Se dispara apenas carga el script, en paralelo a que el usuario escribe su nombre
const productsReady = loadProductsDB();

let currentProduct = null;
let selectedColor = null;

// Variables para la lógica del carrusel (deslizamiento)
let currentSlide = 0;
let isDragging = false;
let startX = 0;
let currentTranslate = 0;
let prevTranslate = 0;
let totalSlides = 0;
const track = document.getElementById('carousel-track');
const indicators = document.getElementById('carousel-indicators');
const carouselContainer = document.getElementById('carousel-container');

// 3. INICIALIZACIÓN Y PLANTILLAS

// Muestra un mensaje de error legible en un contenedor de grilla si el catálogo no cargó
function renderCatalogErrorIfNeeded(container) {
    if (!productsLoadError) return false;
    container.innerHTML = `<p style="color: var(--text-muted); text-align: center; width: 100%; grid-column: span 2;">⚠️ No se pudo cargar el catálogo de productos. Por favor, recargá la página o intentá más tarde.</p>`;
    return true;
}

// Plantilla para inyectar tarjetas de producto en el inicio
function renderProducts() {
    const container = document.getElementById('products-container');
    container.innerHTML = '';
    if (renderCatalogErrorIfNeeded(container)) return;
    productsDB.forEach(prod => {
        container.innerHTML += createProductCardHTML(prod);
    });
}

// 4. LÓGICA DE LA VENTANA MODAL (Detalle de Producto)
function openProduct(id) {
    const product = productsDB.find(p => p.id === id);
    currentProduct = product;
    
    // Guardar en vistos recientemente
    if (!userProfile.recent.includes(id)) {
        userProfile.recent.push(id);
        saveUser();
    }

    // Llenar datos de texto
    document.getElementById('modal-title').innerText = product.title;
    document.getElementById('modal-price').innerText = `$${product.price.toLocaleString('es-CO')}`;
    document.getElementById('modal-tag').innerHTML = `<i class="fa-solid fa-tag"></i> ${product.category}`;
    document.getElementById('modal-desc').innerText = product.desc;
    document.getElementById('spec-material').innerText = product.material;
    document.getElementById('spec-size').innerText = product.size;
    document.getElementById('spec-colors').innerText = `${product.colors.length} opciones`;

    // Estado del Like en el modal
    const likeBtn = document.getElementById('modal-like-btn');
    const isLiked = userProfile.likes.includes(product.id);
    likeBtn.className = `modal-icon-btn ${isLiked ? 'active' : ''}`;
    likeBtn.innerHTML = `<i class="${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i>`;

    // Renderizar opciones de colores rápidos (máximo 5)
    renderColorOptions(product.colors.slice(0, 5));
    
    // Seleccionar el primer color por defecto (carga las imágenes del carrusel)
    changeColor(product.colors[0].name);

    document.getElementById('product-modal').classList.add('active');
}

function closeProduct() {
    document.getElementById('product-modal').classList.remove('active');
    currentProduct = null;
    renderProducts(); // Refrescar likes en el catálogo
}

// 5. SISTEMA DE COLORES E IMÁGENES (CARRUSEL)
function renderColorOptions(colorsArray) {
    const container = document.getElementById('color-options-container');
    container.innerHTML = '';
    
    colorsArray.forEach(color => {
        container.innerHTML += `
            <div class="color-dot" 
                 id="dot-${color.name}"
                 style="background: ${color.hex};" 
                 onclick="changeColor('${color.name}')">
            </div>
        `;
    });
}

function changeColor(colorName) {
    selectedColor = currentProduct.colors.find(c => c.name === colorName);
    
    // Actualizar UI de los puntos (quitar active a todos, poner al seleccionado)
    document.querySelectorAll('.color-dot').forEach(dot => dot.classList.remove('active'));
    const activeDot = document.getElementById(`dot-${colorName}`);
    if(activeDot) activeDot.classList.add('active');

    // --- NUEVA LÓGICA DE CARRUSEL: Cargar imágenes específicas ---
    renderCarousel(selectedColor.images);
    
    closeAllColors(); // Si estaba abierto el overlay, se cierra
}

// NUEVA FUNCIÓN: Renderiza el carrusel para el color seleccionado
function renderCarousel(imagesArray) {
    track.innerHTML = '';
    indicators.innerHTML = '';
    totalSlides = imagesArray.length;
    currentSlide = 0; // Resetear al primer slide al cambiar de color
    
    if (totalSlides === 0) {
        // Fallback si no hay imágenes (muestra icono genérico)
        track.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;width:100%;"><i class="fa-solid fa-cube" style="font-size:8rem;color:white;"></i></div>';
        prevTranslate = 0;
        setTransform(0);
        return;
    }

    // Inyectar imágenes
    imagesArray.forEach((imgSrc, index) => {
        const img = document.createElement('img');
        img.src = imgSrc;
        img.alt = `${currentProduct.title} - ${selectedColor.name}`;
        track.appendChild(img);
        
        // Inyectar punto indicador
        const indicator = document.createElement('div');
        indicator.className = `indicator-dot ${index === 0 ? 'active' : ''}`;
        indicators.appendChild(indicator);
    });

    // Resetear posición de la pista al inicio
    prevTranslate = 0;
    setTransform(0);
}

// NUEVO: LÓGICA DE DESLIZAMIENTO (SWIPE) DEL CARRUSEL
carouselContainer.addEventListener('mousedown', dragStart);
carouselContainer.addEventListener('touchstart', dragStart);

carouselContainer.addEventListener('mousemove', drag);
carouselContainer.addEventListener('touchmove', drag);

carouselContainer.addEventListener('mouseup', dragEnd);
carouselContainer.addEventListener('mouseleave', dragEnd);
carouselContainer.addEventListener('touchend', dragEnd);

function dragStart(e) {
    if (totalSlides <= 1) return; // No deslizar si solo hay una imagen
    isDragging = true;
    startX = getPositionX(e);
    carouselContainer.style.cursor = 'grabbing';
}

function drag(e) {
    if (!isDragging) return;
    const currentX = getPositionX(e);
    const diff = currentX - startX;
    
    // Evitar scroll en móviles mientras se desliza el carrusel
    if(e.type === 'touchmove') e.preventDefault();

    currentTranslate = prevTranslate + diff;
    
    // Pequeño efecto de resistencia en los bordes
    const width = carouselContainer.offsetWidth;
    const maxTranslate = 0;
    const minTranslate = -(totalSlides - 1) * width;
    
    if (currentTranslate > maxTranslate) {
        currentTranslate = diff / 3;
    } else if (currentTranslate < minTranslate) {
        currentTranslate = minTranslate + (diff / 3);
    }

    setTransform(currentTranslate);
}

function dragEnd() {
    isDragging = false;
    carouselContainer.style.cursor = 'grab';
    const width = carouselContainer.offsetWidth;
    
    const movedBy = currentTranslate - prevTranslate;

    // Umbral para cambiar de slide (más del 20% del ancho)
    if (movedBy < -width / 5 && currentSlide < totalSlides - 1) {
        currentSlide++;
    } else if (movedBy > width / 5 && currentSlide > 0) {
        currentSlide--;
    }

    updateSlidePosition();
}

function getPositionX(e) {
    return e.type.includes('mouse') ? e.pageX : e.touches[0].clientX;
}

function setTransform(translate) {
    track.style.transform = `translateX(${translate}px)`;
}

function updateSlidePosition() {
    const width = carouselContainer.offsetWidth;
    currentTranslate = -currentSlide * width;
    prevTranslate = currentTranslate;
    setTransform(currentTranslate);
    
    // Actualizar puntos indicadores
    document.querySelectorAll('.indicator-dot').forEach((dot, index) => {
        dot.classList.toggle('active', index === currentSlide);
    });
}

// Evitar que las imágenes se arrastren como archivos
track.addEventListener('dragstart', (e) => e.preventDefault());


// 6. OVERLAY DE TODOS LOS COLORES
function openAllColors() {
    const container = document.getElementById('grid-all-colors');
    container.innerHTML = '';
    
    currentProduct.colors.forEach(color => {
        container.innerHTML += `
            <div class="color-item-grid" onclick="changeColor('${color.name}')">
                <div class="color-dot" style="background: ${color.hex}; width: 40px; height: 40px;"></div>
                <span>${color.name}</span>
            </div>
        `;
    });
    
    document.getElementById('all-colors-overlay').classList.add('active');
}

function closeAllColors() {
    document.getElementById('all-colors-overlay').classList.remove('active');
}

// 7. FAVORITOS Y PEDIDOS
function toggleLike(id, event) {
    event.stopPropagation(); // Evita que se abra el producto al dar like
    const index = userProfile.likes.indexOf(id);
    if (index === -1) {
        userProfile.likes.push(id);
    } else {
        userProfile.likes.splice(index, 1);
    }
    saveUser();
    renderProducts();
}

function toggleLikeFromModal() {
    const index = userProfile.likes.indexOf(currentProduct.id);
    const likeBtn = document.getElementById('modal-like-btn');
    
    if (index === -1) {
        userProfile.likes.push(currentProduct.id);
        likeBtn.classList.add('active');
        likeBtn.innerHTML = '<i class="fa-solid fa-heart"></i>';
    } else {
        userProfile.likes.splice(index, 1);
        likeBtn.classList.remove('active');
        likeBtn.innerHTML = '<i class="fa-regular fa-heart"></i>';
    }
    saveUser();
}

function sendToWhatsApp() {
    if(!currentProduct || !selectedColor) return;
    
    // Guardar en historial de pedidos local
    userProfile.orders.push({
        id: currentProduct.id,
        color: selectedColor.name,
        date: new Date().toLocaleDateString()
    });
    saveUser();
    
    const message = `¡Hola ${userProfile.name ? 'soy ' + userProfile.name : ''}! Vengo del catálogo web. 👋\n\nMe interesa pedir:\n*${currentProduct.title}*\n*Precio:* $${currentProduct.price.toLocaleString('es-CO')}\n*Color:* ${selectedColor.name}\n\n¿Me podrías confirmar mi pedido?`;
    
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
}

// ==========================================
// 8. FUNCIÓN PARA COMPARTIR PRODUCTO
// ==========================================

async function shareProduct() {
    if (!currentProduct) return;

    // Formateamos el precio para el mensaje
    const priceFormatted = `$${currentProduct.price.toLocaleString('es-CO')}`;
    
    // Armamos los datos a compartir
    const shareData = {
        title: `Tridi - ${currentProduct.title}`,
        text: `¡Mira este increíble ${currentProduct.title} impreso en 3D! 🔥\nPrecio: ${priceFormatted}\nDescúbrelo en nuestro catálogo:\n`,
        url: window.location.href // Comparte el link actual de tu página
    };

    try {
        // Intentamos usar el menú nativo de compartir del celular
        if (navigator.share) {
            await navigator.share(shareData);
            console.log('Producto compartido exitosamente');
        } else {
            // Plan B (Fallback): Si está en PC y no soporta share, copiamos al portapapeles
            fallbackShare(shareData.text + " " + shareData.url);
        }
    } catch (err) {
        // El usuario canceló o hubo un error silencioso
        console.log('Se canceló la acción de compartir o hubo un error:', err);
    }
}

// Función auxiliar para copiar al portapapeles
function fallbackShare(textToCopy) {
    navigator.clipboard.writeText(textToCopy).then(() => {
        showToast('¡Enlace copiado al portapapeles! 📋');
    }).catch(err => {
        console.error('Error al copiar:', err);
        alert('No se pudo copiar el enlace.');
    });
}

// Función auxiliar para mostrar notificaciones pequeñas en pantalla (Toast)
function showToast(message) {
    // Evitar que se acumulen muchos toasts
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerText = message;
    document.body.appendChild(toast);

    // Mostrar con pequeña animación
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Ocultar y remover después de 3 segundos
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300); // 300ms es lo que dura la transición CSS
    }, 3000);
}
// ==========================================
// 9. NAVEGACIÓN INFERIOR Y CONTROL DE VISTAS
// ==========================================

const screens = ['catalog-screen', 'explorar-screen', 'pedidos-screen', 'favoritos-screen', 'perfil-screen', 'auth-screen'];
let targetScreenAfterAuth = '';

// Modificar función startApp existente
async function startApp() {
    const nameInput = document.getElementById('username-input').value;
    if (nameInput.trim() !== "") {
        userProfile.name = nameInput.trim();
        saveUser();
    }

    // Esperar a que termine de cargar data/products.json antes de mostrar el catálogo
    await productsReady;

    document.getElementById('hero-screen').style.display = 'none';
    document.getElementById('bottom-nav').style.display = 'flex'; // Mostrar barra inferior
    
    navigate('catalog'); // Ir al inicio
}

function navigate(screenPrefix) {
    // 1. Verificación de Autenticación
    const requiresAuth = ['pedidos', 'favoritos', 'perfil'].includes(screenPrefix);
    
    if (requiresAuth && !userProfile.name) {
        targetScreenAfterAuth = screenPrefix; // Guardar a dónde quería ir
        showScreen('auth-screen');
        updateNavHighlight(''); // Ningún icono activo si está en login
        return;
    }

    // 2. Renderizar contenido dinámico según la vista
    if (screenPrefix === 'catalog') {
        renderProducts(); // Tu función actual
        document.getElementById('greeting-title').innerText = userProfile.name ? `¡Hola, ${userProfile.name}! 👋` : "¡Hola! 👋";
    } else if (screenPrefix === 'explorar') {
        renderExplorar();
    } else if (screenPrefix === 'favoritos') {
        renderFavoritos();
    } else if (screenPrefix === 'pedidos') {
        renderPedidos();
    } else if (screenPrefix === 'perfil') {
        renderPerfil();
    }

    // 3. Cambiar la vista
    showScreen(`${screenPrefix}-screen`);
    
    // 4. Actualizar ícono activo
    updateNavHighlight(`nav-${screenPrefix}`);
}

function showScreen(screenId) {
    screens.forEach(s => {
        const el = document.getElementById(s);
        if(el) el.style.display = 'none';
    });
    const target = document.getElementById(screenId);
    if(target) {
        target.style.display = 'block';
        target.style.animation = 'fadeIn 0.4s ease';
    }
}

function updateNavHighlight(navId) {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    if(navId) {
        const activeItem = document.getElementById(navId);
        if(activeItem) activeItem.classList.add('active');
    }
}

function quickLogin() {
    const nameInput = document.getElementById('login-input').value;
    if (nameInput.trim() !== "") {
        userProfile.name = nameInput.trim();
        saveUser();
        navigate(targetScreenAfterAuth || 'catalog'); // Continuar a donde iba
    }
}

function logout() {
    userProfile.name = null;
    saveUser();
    toggleSidebar(); // Cerrar menú
    navigate('catalog'); // Enviar a inicio público
}

// ==========================================
// 10. RENDERIZADO DE LAS NUEVAS VISTAS
// ==========================================

function renderExplorar() {
    const container = document.getElementById('explorar-container');
    container.innerHTML = '';
    if (renderCatalogErrorIfNeeded(container)) return;
    // Mostramos todos (reutilizamos la plantilla de tarjetas)
    productsDB.forEach(prod => {
        container.innerHTML += createProductCardHTML(prod);
    });
}

function renderFavoritos() {
    const container = document.getElementById('favoritos-container');
    container.innerHTML = '';
    if (renderCatalogErrorIfNeeded(container)) return;

    if(userProfile.likes.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); text-align: center; width: 100%; grid-column: span 2;">Aún no tienes productos favoritos. 💔</p>`;
        return;
    }

    productsDB.forEach(prod => {
        if(userProfile.likes.includes(prod.id)) {
            container.innerHTML += createProductCardHTML(prod);
        }
    });
}

function renderPedidos() {
    const container = document.getElementById('pedidos-container');
    container.innerHTML = '';

    if(userProfile.orders.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); text-align: center;">No has realizado ningún pedido todavía. 📦</p>`;
        return;
    }

    // Invertimos para mostrar el más reciente arriba
    [...userProfile.orders].reverse().forEach(order => {
        const prod = productsDB.find(p => p.id === order.id);
        if(!prod) return;
        
        container.innerHTML += `
            <div class="order-card">
                <div class="order-card-header">
                    <span>${order.date}</span>
                    <span class="tag" style="margin:0; background: rgba(59, 130, 246, 0.2); color: #93c5fd;">Completado</span>
                </div>
                <div style="display: flex; gap: 15px; align-items: center; margin-top: 10px;">
                    <div style="width: 50px; height: 50px; background: rgba(255,255,255,0.05); border-radius: 10px; padding: 5px;">
                        <img src="${prod.mainImage}" style="width: 100%; height: 100%; object-fit: contain;">
                    </div>
                    <div>
                        <div class="order-card-title">${prod.title}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">Color: ${order.color}</div>
                    </div>
                </div>
            </div>
        `;
    });
}

function renderPerfil() {
    document.getElementById('profile-name').innerText = userProfile.name;
    // Puntos Tridi (Ejemplo: 10 puntos por cada pedido realizado)
    const puntos = userProfile.orders.length * 10;
    document.getElementById('profile-points').innerText = puntos;
}

// Función auxiliar para no repetir código de creación de tarjetas
function createProductCardHTML(prod) {
    const isLiked = userProfile.likes.includes(prod.id);
    const formatPrice = `$${prod.price.toLocaleString('es-CO')}`;
    return `
        <div class="product-card" onclick="openProduct('${prod.id}')">
            <button class="like-btn ${isLiked ? 'active' : ''}" onclick="toggleLike('${prod.id}', event)">
                <i class="${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
            </button>
            <div class="product-img">
                <img src="${prod.mainImage}" alt="${prod.title}" class="img-placeholder" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 512 512\\'%3E%3Cpath d=\\'M32 448c0 17.7 14.3 32 32 32h384c17.7 0 32-14.3 32-32V64c0-17.7-14.3-32-32-32H64C46.3 32 32 46.3 32 64v384zm224-224a48 48 0 1 1 0 96 48 48 0 1 1 0-96z\\'/%3E%3C/svg%3E';">
            </div>
            <h4 class="product-title">${prod.title}</h4>
            <span class="product-price">${formatPrice}</span>
        </div>
    `;
}

// ==========================================
// 11. MENÚ LATERAL (HAMBURGUESA)
// ==========================================
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}