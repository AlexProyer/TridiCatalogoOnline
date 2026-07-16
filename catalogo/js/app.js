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

// Estado de búsqueda y filtro por categoría (catálogo e Explorar)
let catalogSearchQuery = '';
let explorarSearchQuery = '';
let currentCategoryFilter = null;

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
    container.innerHTML = `<p style="color: var(--text-muted); text-align: center; width: 100%; grid-column: span 2;">⚠️ No se pudo cargar el catálogo de productos. Por favor, recarga la página o intenta más tarde.</p>`;
    return true;
}

// Plantilla para inyectar tarjetas de producto en el inicio
function renderProducts() {
    const container = document.getElementById('products-container');
    container.innerHTML = '';
    if (renderCatalogErrorIfNeeded(container)) return;

    const productsToShow = filterProductsByQuery(productsDB, catalogSearchQuery);

    if (productsToShow.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); text-align: center; width: 100%; grid-column: span 2;">No encontramos productos para "${catalogSearchQuery}". 🔍</p>`;
        return;
    }

    productsToShow.forEach(prod => {
        container.innerHTML += createProductCardHTML(prod);
    });
}

// Filtra productos por título/categoría (usado por las dos barras de búsqueda)
function filterProductsByQuery(products, query) {
    const q = query.trim().toLowerCase();
    if (q === '') return products;
    return products.filter(p =>
        p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
    );
}

function handleCatalogSearch(query) {
    catalogSearchQuery = query;
    renderProducts();
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

    // Oculta las flechas de navegación (desktop) cuando no hay nada entre qué navegar
    carouselContainer.classList.toggle('single-image', totalSlides <= 1);

    if (totalSlides === 0) {
        // Fallback si no hay imágenes (muestra icono genérico)
        track.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;width:100%;"><i class="fa-solid fa-cube" style="font-size:8rem;color:white;"></i></div>';
        prevTranslate = 0;
        setTransform(0);
        return;
    }

    // Inyectar imágenes (con <picture> para servir WebP con fallback a JPEG)
    imagesArray.forEach((imgSrc, index) => {
        const picture = document.createElement('picture');

        const source = document.createElement('source');
        source.srcset = toWebpPath(imgSrc);
        source.type = 'image/webp';
        picture.appendChild(source);

        const img = document.createElement('img');
        img.src = imgSrc;
        img.alt = `${currentProduct.title}, color ${selectedColor.name} (foto ${index + 1} de ${imagesArray.length})`;
        img.loading = 'lazy';
        img.onload = () => img.classList.add('loaded');
        picture.appendChild(img);

        track.appendChild(picture);

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

// Flechas de navegación del carrusel (desktop, además del drag/swipe existente)
function goToSlide(direction) {
    if (totalSlides <= 1) return;
    const newSlide = currentSlide + direction;
    if (newSlide < 0 || newSlide > totalSlides - 1) return;
    currentSlide = newSlide;
    updateSlidePosition();
}

// Evitar que las imágenes se arrastren como archivos
track.addEventListener('dragstart', (e) => e.preventDefault());

// Búsqueda en vivo (catálogo y Explorar)
document.getElementById('catalog-search-input')
    .addEventListener('input', (e) => handleCatalogSearch(e.target.value));
document.getElementById('explorar-search-input')
    .addEventListener('input', (e) => handleExplorarSearch(e.target.value));


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
    // Revela la barra inferior (mobile) o superior (tablet/desktop) vía CSS,
    // según el breakpoint activo — ver .app-container.app-started en style.css
    document.getElementById('app-container').classList.add('app-started');

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
        catalogSearchQuery = '';
        const catalogInput = document.getElementById('catalog-search-input');
        if (catalogInput) catalogInput.value = '';
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
    updateNavHighlight(screenPrefix);
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

// navKey es el mismo valor que screenPrefix ('catalog', 'explorar', etc.) y
// marca como activo cualquier elemento con ese data-nav, tanto en la barra
// inferior (mobile) como en la barra superior (tablet/desktop) a la vez.
function updateNavHighlight(navKey) {
    document.querySelectorAll('.nav-item, .top-nav-item').forEach(item => item.classList.remove('active'));
    if (navKey) {
        document.querySelectorAll(`[data-nav="${navKey}"]`).forEach(item => item.classList.add('active'));
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
    renderExplorarFilterChip();
    if (renderCatalogErrorIfNeeded(container)) return;

    let productsToShow = currentCategoryFilter
        ? productsDB.filter(p => p.category === currentCategoryFilter)
        : productsDB;
    productsToShow = filterProductsByQuery(productsToShow, explorarSearchQuery);

    if (productsToShow.length === 0) {
        let mensaje;
        if (currentCategoryFilter && explorarSearchQuery.trim() !== '') {
            mensaje = `No encontramos productos en "${currentCategoryFilter}" para "${explorarSearchQuery}". 🔍`;
        } else if (currentCategoryFilter) {
            mensaje = `No hay productos en "${currentCategoryFilter}" todavía. 🙁`;
        } else {
            mensaje = `No encontramos productos para "${explorarSearchQuery}". 🔍`;
        }
        container.innerHTML = `<p style="color: var(--text-muted); text-align: center; width: 100%; grid-column: span 2;">${mensaje}</p>`;
        return;
    }

    productsToShow.forEach(prod => {
        container.innerHTML += createProductCardHTML(prod);
    });
}

// Chip que muestra el filtro de categoría activo en Explorar, con opción de quitarlo
function renderExplorarFilterChip() {
    const chipContainer = document.getElementById('explorar-filter-chip');
    if (!chipContainer) return;

    if (!currentCategoryFilter) {
        chipContainer.innerHTML = '';
        return;
    }

    chipContainer.innerHTML = `
        <div class="tag" style="cursor: pointer; margin-bottom: 1rem;" onclick="clearCategoryFilter()">
            <i class="fa-solid fa-filter"></i> ${currentCategoryFilter}
            <i class="fa-solid fa-xmark" style="margin-left: 6px;"></i>
        </div>
    `;
}

function clearCategoryFilter() {
    currentCategoryFilter = null;
    renderExplorar();
}

function handleExplorarSearch(query) {
    explorarSearchQuery = query;
    renderExplorar();
}

// Ir a Explorar filtrado por una categoría (desde los íconos de categorías del inicio)
function filterByCategory(category) {
    currentCategoryFilter = category;
    explorarSearchQuery = '';
    const explorarInput = document.getElementById('explorar-search-input');
    if (explorarInput) explorarInput.value = '';
    navigate('explorar');
}

// Ir a Explorar sin ningún filtro (barra inferior y "Ver todo")
function goExplorar() {
    currentCategoryFilter = null;
    explorarSearchQuery = '';
    const explorarInput = document.getElementById('explorar-search-input');
    if (explorarInput) explorarInput.value = '';
    navigate('explorar');
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
                        <picture>
                            <source srcset="${toWebpPath(prod.mainImage)}" type="image/webp">
                            <img src="${prod.mainImage}" alt="${prod.title}" loading="lazy" style="width: 100%; height: 100%; object-fit: contain;">
                        </picture>
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

// Deriva la ruta .webp equivalente de una imagen .jpg/.jpeg/.png ya existente
// (se generó un .webp hermano para cada imagen real del catálogo; si alguna
// imagen todavía no tiene su .webp, el <source> simplemente no matchea y el
// navegador cae al <img> de toda la vida, sin romper nada)
function toWebpPath(imagePath) {
    return imagePath.replace(/\.(jpe?g|png)$/i, '.webp');
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
                <picture>
                    <source srcset="${toWebpPath(prod.mainImage)}" type="image/webp">
                    <img src="${prod.mainImage}" alt="${prod.title} — foto principal" class="img-placeholder" loading="lazy"
                         onload="this.closest('.product-img').classList.add('loaded')"
                         onerror="this.closest('.product-img').classList.add('loaded'); this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 512 512\\'%3E%3Cpath d=\\'M32 448c0 17.7 14.3 32 32 32h384c17.7 0 32-14.3 32-32V64c0-17.7-14.3-32-32-32H64C46.3 32 32 46.3 32 64v384zm224-224a48 48 0 1 1 0 96 48 48 0 1 1 0-96z\\'/%3E%3C/svg%3E';">
                </picture>
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

// ==========================================
// 12. OVERLAY DE INFORMACIÓN (Sobre Tridi / Envíos y Cambios / Privacidad)
// ==========================================

const INFO_CONTENT = {
    sobre: {
        title: 'Sobre Tridi',
        html: `
            <p>Somos un grupo de 5 amigos. Tridi es eso: un grupo, no una sola persona.
            Arrancamos a inicios de 2025 con una impresora, una Bambu Lab P1S, con ganas
            de meternos de lleno al mundo de la impresión 3D resolviendo cosas que
            parecían complicadas — como conseguir un repuesto puntual que ya nadie
            fabricaba.</p>

            <p>De ahí fuimos ampliando lo que hacíamos. Con los primeros pedidos pudimos
            sumar una segunda impresora, una Bambu Lab P2S. Hoy trabajamos con las dos.</p>

            <h4>Qué nos diferencia</h4>
            <p>No solo imprimimos lo que nos piden: acompañamos a cada cliente a resolver
            lo que necesita, aunque todavía no sepa bien cómo pedirlo. Todo lo que
            hacemos es a medida — no manejamos una línea de producción en serie, cada
            pieza se ajusta a quien la pidió.</p>

            <h4>Cómo elegimos el material</h4>
            <p>El material se elige según el uso que le vas a dar, no al revés: piezas
            decorativas en un plástico estándar (PLA), piezas que necesitan más
            resistencia al uso diario en un material más duro (PETG), y repuestos
            exigentes en polímeros técnicos (PPS). Buscamos el mejor balance entre
            calidad y precio para cada pedido — no la opción más barata a secas.</p>
        `
    },
    envios: {
        title: 'Envíos y Cambios',
        html: `
            <h4>Cómo funciona</h4>
            <p>Todo lo hacemos bajo pedido. Según el diseño, el tiempo de fabricación es
            de 2 a 5 días hábiles.</p>

            <h4>Entrega en Bogotá</h4>
            <p>Coordinamos entrega personal, en un punto medio, o puedes recoger
            directamente en el punto de fabricación.</p>

            <h4>Envíos nacionales</h4>
            <p>A cualquier parte de Colombia, por transportadoras certificadas (por
            ejemplo, Interrápidísimo).</p>

            <h4>Cambios</h4>
            <p>Si tu pedido llegó con un daño evidente de impresión, o falló en un uso
            donde normalmente no debería fallar (por ejemplo, una lámpara que empezó a
            derretirse), te lo cambiamos sin costo — es responsabilidad nuestra.</p>

            <h4>Devoluciones</h4>
            <p>No aceptamos devoluciones. Como trabajamos bajo pedido y cada pieza es
            personalizada, no tenemos cómo revenderla — aceptar devoluciones sería una
            pérdida total para nosotros. Por eso es clave confirmar bien los detalles
            (color, tamaño, texto del llavero, etc.) antes de cerrar el pedido por
            WhatsApp.</p>
        `
    },
    privacidad: {
        title: 'Privacidad',
        html: `
            <p>Este catálogo no tiene servidor propio ni base de datos: es un sitio
            estático.</p>

            <p>Lo único que guardamos es lo que ves en tu propio navegador
            (<code>localStorage</code>), y nunca sale de tu dispositivo:</p>
            <ul>
                <li>Tu nombre (si lo escribiste), para saludarte y para armar el mensaje de WhatsApp.</li>
                <li>Tus productos favoritos.</li>
                <li>Tu historial de "pedidos" (en realidad, un registro local de qué productos consultaste por WhatsApp).</li>
            </ul>

            <p>Nada de esto llega a Tridi. Lo único que efectivamente recibimos es el
            mensaje de WhatsApp que tú mismo envías al tocar "Pedir por WhatsApp" — ahí
            sí vemos tu número y lo que escribas.</p>

            <p>Si borras los datos del sitio en tu navegador, o cambias de dispositivo,
            ese historial local desaparece. No hay forma de recuperarlo porque nunca
            estuvo en ningún servidor.</p>
        `
    }
};

function openInfoOverlay(key) {
    const data = INFO_CONTENT[key];
    if (!data) return;
    document.getElementById('info-overlay-title').innerText = data.title;
    document.getElementById('info-overlay-content').innerHTML = data.html;
    document.getElementById('info-overlay').classList.add('active');
    if (document.getElementById('sidebar').classList.contains('active')) {
        toggleSidebar(); // Cerrar el menú lateral al abrir la información
    }
}

function closeInfoOverlay() {
    document.getElementById('info-overlay').classList.remove('active');
}