
import { supabase } from './supabase.js';

// ==========================================
// VARIABLES GLOBALES
// ==========================================

let usuarioActual = null;
let perfilActual = null;
let esAdministrador = false;
let solicitudesActuales = [];
let solicitudSeleccionada = null;
let modoRegistro = false;
let tipoAccesoSeleccionado = null;

const $ = (id) => document.getElementById(id);

const paginaPublica = $('paginaPublica');
const accessSection = $('accessSection');
const authSection = $('authSection');
const dashboard = $('dashboard');

// ==========================================
// UTILIDADES
// ==========================================

function mostrarMensaje(id, mensaje, tipo = 'success') {
    const elemento = $(id);
    if (!elemento) return;

    elemento.textContent = mensaje;
    elemento.className = `message ${tipo}`;
}

function mostrarToast(mensaje) {
    const toast = $('toast');
    toast.textContent = mensaje;
    toast.classList.add('show');

    setTimeout(() => toast.classList.remove('show'), 3000);
}

function escapar(texto = '') {
    return String(texto).replace(/[&<>"']/g, caracter => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[caracter]);
}

function fechaFormato(fecha) {
    if (!fecha) return 'Sin fecha';

    return new Date(fecha).toLocaleDateString('es-DO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

function textoEstado(estado) {
    const estados = {
        pendiente: 'Pendiente',
        en_proceso: 'En proceso',
        resuelta: 'Resuelta',
        cerrada: 'Cerrada'
    };

    return estados[estado] || estado;
}

function textoPrioridad(prioridad) {
    return String(prioridad || '').charAt(0).toUpperCase() +
        String(prioridad || '').slice(1);
}

function limpiarMensajes() {
    document.querySelectorAll('.message').forEach(elemento => {
        elemento.textContent = '';
        elemento.className = 'message';
    });
}

// ==========================================
// NAVEGACIÓN DE PANTALLAS
// ==========================================

function mostrarInicio() {
    paginaPublica.classList.remove('hidden');
    accessSection.classList.add('hidden');
    authSection.classList.add('hidden');
    dashboard.classList.add('hidden');

    tipoAccesoSeleccionado = null;

    window.scrollTo(0, 0);
}

function mostrarSeleccionAcceso() {
    paginaPublica.classList.add('hidden');
    authSection.classList.add('hidden');
    dashboard.classList.add('hidden');
    accessSection.classList.remove('hidden');

    window.scrollTo(0, 0);
}

// ==========================================
// SELECCIÓN CLIENTE / ADMINISTRADOR
// ==========================================

function seleccionarAcceso(rol, registro = false) {
    tipoAccesoSeleccionado = rol;
    mostrarAutenticacion(registro);
}

$('btnLogin').addEventListener('click', () => {
    mostrarSeleccionAcceso();
});

$('btnRegistro').addEventListener('click', () => {
    seleccionarAcceso('cliente', true);
});

$('btnCrearSolicitud').addEventListener('click', () => {
    seleccionarAcceso('cliente', true);
});

$('btnAccesoCliente').addEventListener('click', () => {
    seleccionarAcceso('cliente');
});

$('btnAccesoAdmin').addEventListener('click', () => {
    seleccionarAcceso('administrador');
});

$('btnVolverPortada').addEventListener('click', mostrarInicio);

// ==========================================
// AUTENTICACIÓN
// ==========================================

function mostrarAutenticacion(registro = false) {
    modoRegistro = registro;

    paginaPublica.classList.add('hidden');
    accessSection.classList.add('hidden');
    dashboard.classList.add('hidden');
    authSection.classList.remove('hidden');

    $('authTitle').textContent = registro
        ? 'Crear una cuenta'
        : tipoAccesoSeleccionado === 'administrador'
            ? 'Acceso administrativo'
            : 'Acceso de cliente';

    $('authDescription').textContent = registro
        ? 'Regístrate para comenzar a utilizar la plataforma.'
        : 'Ingresa tus credenciales para continuar.';

    $('authSubmit').textContent = registro
        ? 'Crear cuenta'
        : 'Iniciar sesión';

    $('nombreGroup').classList.toggle('hidden', !registro);
    $('nombre').required = registro;

    $('authSwitch').innerHTML = registro
        ? '¿Ya tienes cuenta? <button type="button" id="btnCambiarRegistro">Inicia sesión</button>'
        : tipoAccesoSeleccionado === 'cliente'
            ? '¿No tienes cuenta? <button type="button" id="btnCambiarRegistro">Regístrate</button>'
            : '';

    $('authForm').reset();

    limpiarMensajes();

    const cambiarRegistro = $('btnCambiarRegistro');

    if (cambiarRegistro) {
        cambiarRegistro.addEventListener('click', () => {
            mostrarAutenticacion(!modoRegistro);
        });
    }

    window.scrollTo(0, 0);
}

$('btnVolver').addEventListener('click', mostrarSeleccionAcceso);

$('btnConocer').addEventListener('click', () => {
    $('servicios').scrollIntoView({
        behavior: 'smooth'
    });
});

$('logoInicio').addEventListener('click', (e) => {
    e.preventDefault();
    mostrarInicio();
});

$('menuToggle').addEventListener('click', () => {
    $('navActions').classList.toggle('open');
});

// ==========================================
// REGISTRO E INICIO DE SESIÓN
// ==========================================

$('authForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const correo = $('correo').value.trim().toLowerCase();
    const password = $('password').value;
    const nombre = $('nombre').value.trim();

    const boton = $('authSubmit');

    boton.disabled = true;
    boton.textContent = 'Procesando...';

    try {

        // REGISTRO EXCLUSIVO PARA CLIENTES

        if (modoRegistro) {

            if (tipoAccesoSeleccionado !== 'cliente') {
                throw new Error(
                    'El registro está disponible únicamente para clientes.'
                );
            }

            if (nombre.length < 2) {
                throw new Error('Escribe tu nombre completo.');
            }

            if (password.length < 6) {
                throw new Error(
                    'La contraseña debe tener al menos 6 caracteres.'
                );
            }

            const { data, error } = await supabase.auth.signUp({
                email: correo,
                password: password,
                options: {
                    data: {
                        nombre: nombre
                    }
                }
            });

            if (error) throw error;

            if (data.session) {

                mostrarMensaje(
                    'authMessage',
                    'Cuenta creada correctamente. Entrando...',
                    'success'
                );

                await cargarPerfil(data.user);

            } else {

                mostrarMensaje(
                    'authMessage',
                    'Registro realizado. Revisa tu correo para confirmar la cuenta antes de iniciar sesión.',
                    'success'
                );

            }

        } else {

            // INICIO DE SESIÓN

            const { data, error } = await supabase.auth.signInWithPassword({
                email: correo,
                password: password
            });

            if (error) throw error;

            await cargarPerfil(data.user);
        }

    } catch (error) {

        mostrarMensaje(
            'authMessage',
            error.message,
            'error'
        );

    } finally {

        boton.disabled = false;

        boton.textContent = modoRegistro
            ? 'Crear cuenta'
            : 'Iniciar sesión';
    }
});

// ==========================================
// CARGAR PERFIL DEL USUARIO
// ==========================================

async function cargarPerfil(usuario) {

    usuarioActual = usuario;

    const { data, error } = await supabase
        .from('usuarios')
        .select('id, nombre, correo, rol')
        .eq('id', usuario.id)
        .maybeSingle();

    if (error) {

        console.error(error);

        await supabase.auth.signOut();

        usuarioActual = null;

        mostrarAutenticacion(false);

        mostrarMensaje(
            'authMessage',
            'No se pudo consultar tu perfil. Verifica tu conexión y permisos.',
            'error'
        );

        return;
    }

    if (!data) {

        await supabase.auth.signOut();

        usuarioActual = null;

        mostrarAutenticacion(false);

        mostrarMensaje(
            'authMessage',
            'No se encontró tu perfil. Contacta al administrador.',
            'error'
        );

        return;
    }

    // VALIDAR ROLES

    if (!['cliente', 'administrador'].includes(data.rol)) {

        await supabase.auth.signOut();

        usuarioActual = null;

        mostrarAutenticacion(false);

        mostrarMensaje(
            'authMessage',
            'Esta cuenta no tiene un rol autorizado.',
            'error'
        );

        return;
    }

    // COMPROBAR EL TIPO DE ACCESO SELECCIONADO

    if (
        tipoAccesoSeleccionado &&
        data.rol !== tipoAccesoSeleccionado
    ) {

        await supabase.auth.signOut();

        usuarioActual = null;
        perfilActual = null;
        esAdministrador = false;

        mostrarAutenticacion(false);

        mostrarMensaje(
            'authMessage',
            'Esta cuenta no corresponde al tipo de acceso seleccionado.',
            'error'
        );

        return;
    }

    perfilActual = data;

    esAdministrador = data.rol === 'administrador';

    abrirDashboard();
}

// ==========================================
// ABRIR PANEL PRINCIPAL
// ==========================================

function abrirDashboard() {

    paginaPublica.classList.add('hidden');
    accessSection.classList.add('hidden');
    authSection.classList.add('hidden');
    dashboard.classList.remove('hidden');

    const nombre = perfilActual.nombre || perfilActual.correo;
    const inicial = nombre.charAt(0).toUpperCase();

    $('sidebarName').textContent = nombre;
    $('headerName').textContent = nombre;
    $('welcomeName').textContent = `Hola, ${nombre}`;

    $('userAvatar').textContent = inicial;
    $('headerAvatar').textContent = inicial;

    $('sidebarRole').textContent = esAdministrador
        ? 'Administrador'
        : 'Cliente';

    $('dashboardTitle').textContent = esAdministrador
        ? 'Panel administrativo'
        : 'Panel del cliente';

    // CONFIGURACIÓN SEGÚN EL ROL

    $('crearPanel').classList.toggle(
        'hidden',
        esAdministrador
    );

    $('sideUsuarios').classList.toggle(
        'hidden',
        !esAdministrador
    );

    $('usuarioColumn').classList.toggle(
        'hidden',
        !esAdministrador
    );

    $('accionesColumn').classList.toggle(
        'hidden',
        !esAdministrador
    );

    $('listaTitulo').textContent = esAdministrador
        ? 'Todas las solicitudes'
        : 'Mis solicitudes';

    mostrarSeccion('inicio');

}

// ==========================================
// NAVEGACIÓN DEL DASHBOARD
// ==========================================

function mostrarSeccion(seccion) {

    $('crearPanel').classList.toggle(
        'hidden',
        esAdministrador || seccion !== 'inicio'
    );

    $('listaPanel').classList.toggle(
        'hidden',
        seccion === 'usuarios'
    );

    $('usuariosPanel').classList.toggle(
        'hidden',
        seccion !== 'usuarios' || !esAdministrador
    );

    $('sideInicio').classList.toggle(
        'active',
        seccion === 'inicio'
    );

    $('sideSolicitudes').classList.toggle(
        'active',
        seccion === 'solicitudes'
    );

    $('sideUsuarios').classList.toggle(
        'active',
        seccion === 'usuarios'
    );

    if (seccion === 'usuarios' && esAdministrador) {
        cargarUsuarios();
    }

    if (seccion === 'solicitudes' || seccion === 'inicio') {
        cargarSolicitudes();
    }
}

$('sideInicio').addEventListener('click', () => {
    mostrarSeccion('inicio');
});

$('sideSolicitudes').addEventListener('click', () => {
    mostrarSeccion('solicitudes');
});

$('sideUsuarios').addEventListener('click', () => {

    if (esAdministrador) {
        mostrarSeccion('usuarios');
    }

});

// ==========================================
// CREAR SOLICITUD
// ==========================================

$('solicitudForm').addEventListener('submit', async (e) => {

    e.preventDefault();

    if (!usuarioActual || esAdministrador) return;

    const boton = $('btnEnviarSolicitud');

    boton.disabled = true;
    boton.textContent = 'Enviando...';

    try {

        const solicitud = {
            usuario_id: usuarioActual.id,
            titulo: $('titulo').value.trim(),
            categoria: $('categoria').value,
            prioridad: $('prioridad').value,
            descripcion: $('descripcion').value.trim(),
            estado: 'pendiente'
        };

        if (
            !solicitud.titulo ||
            !solicitud.categoria ||
            !solicitud.descripcion
        ) {
            throw new Error('Completa todos los campos.');
        }

        const { error } = await supabase
            .from('solicitudes')
            .insert(solicitud);

        if (error) throw error;

        $('solicitudForm').reset();

        mostrarMensaje(
            'solicitudMessage',
            '¡Solicitud registrada correctamente!',
            'success'
        );

        mostrarToast('Solicitud creada correctamente.');

        await cargarSolicitudes();

    } catch (error) {

        mostrarMensaje(
            'solicitudMessage',
            error.message,
            'error'
        );

    } finally {

        boton.disabled = false;
        boton.textContent = 'Enviar solicitud →';

    }

});

// ==========================================
// CONSULTAR SOLICITUDES
// ==========================================

async function cargarSolicitudes() {

    if (!usuarioActual) return;

    const tbody = $('solicitudesBody');

    tbody.innerHTML = `
        <tr>
            <td colspan="8" class="empty-state">
                Cargando solicitudes...
            </td>
        </tr>
    `;

    try {

        let consulta = supabase
            .from('solicitudes')
            .select('*')
            .order('creado_en', { ascending: false });

        // EL CLIENTE SOLO CONSULTA SUS SOLICITUDES

        if (!esAdministrador) {
            consulta = consulta.eq(
                'usuario_id',
                usuarioActual.id
            );
        }

        const { data, error } = await consulta;

        if (error) throw error;

        solicitudesActuales = data || [];

        let usuarios = [];

        // OBTENER CLIENTES PARA EL ADMINISTRADOR

        if (
            esAdministrador &&
            solicitudesActuales.length > 0
        ) {

            const ids = [...new Set(
                solicitudesActuales.map(s => s.usuario_id)
            )];

            const { data: perfiles, error: errorUsuarios } =
                await supabase
                    .from('usuarios')
                    .select('id, nombre, correo')
                    .in('id', ids);

            if (errorUsuarios) throw errorUsuarios;

            usuarios = perfiles || [];
        }

        const mapaUsuarios = Object.fromEntries(
            usuarios.map(u => [u.id, u])
        );

        actualizarEstadisticas(solicitudesActuales);

        pintarSolicitudes(
            solicitudesActuales,
            mapaUsuarios
        );

    } catch (error) {

        console.error(error);

        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    Error al cargar las solicitudes.
                    Verifica los permisos de Supabase.
                </td>
            </tr>
        `;

        mostrarToast(error.message);

    }
}

// ==========================================
// ESTADÍSTICAS
// ==========================================

function actualizarEstadisticas(datos) {

    $('statTotal').textContent = datos.length;

    $('statPendientes').textContent =
        datos.filter(s => s.estado === 'pendiente').length;

    $('statProceso').textContent =
        datos.filter(s => s.estado === 'en_proceso').length;

    $('statResueltas').textContent =
        datos.filter(s => s.estado === 'resuelta').length;

}

// ==========================================
// MOSTRAR SOLICITUDES EN LA TABLA
// ==========================================

function pintarSolicitudes(datos, mapaUsuarios = {}) {

    const tbody = $('solicitudesBody');

    const busqueda = $('buscarSolicitud').value.toLowerCase();

    const filtro = $('filtroEstado').value;

    const filtrados = datos.filter(s => {

        const coincideTexto = String(s.titulo || '')
            .toLowerCase()
            .includes(busqueda);

        const coincideEstado = !filtro || s.estado === filtro;

        return coincideTexto && coincideEstado;

    });

    if (!filtrados.length) {

        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    No hay solicitudes para mostrar.
                </td>
            </tr>
        `;

        return;
    }

    tbody.innerHTML = filtrados.map(s => {

        const usuario = mapaUsuarios[s.usuario_id];

        return `
            <tr>

                <td>#${escapar(s.id)}</td>

                <td>${escapar(s.titulo)}</td>

                <td>${escapar(s.categoria)}</td>

                <td>
                    <span class="priority priority-${escapar(s.prioridad)}">
                        ${escapar(textoPrioridad(s.prioridad))}
                    </span>
                </td>

                <td>
                    <span class="status status-${escapar(s.estado)}">
                        ${escapar(textoEstado(s.estado))}
                    </span>
                </td>

                <td>${fechaFormato(s.creado_en)}</td>

                ${esAdministrador ? `
                    <td>
                        ${escapar(
                            usuario?.nombre ||
                            usuario?.correo ||
                            'Cliente'
                        )}
                    </td>

                    <td>
                        <button
                            class="action-button"
                            data-detalle="${escapar(s.id)}">
                            Ver / Gestionar
                        </button>
                    </td>
                ` : `
                    <td>
                        <button
                            class="action-button"
                            data-detalle="${escapar(s.id)}">
                            Ver detalle
                        </button>
                    </td>
                `}

            </tr>
        `;

    }).join('');

}

// ==========================================
// BUSCAR Y FILTRAR
// ==========================================

$('buscarSolicitud').addEventListener('input', () => {
    pintarSolicitudes(solicitudesActuales);
});

$('filtroEstado').addEventListener('change', () => {
    pintarSolicitudes(solicitudesActuales);
});

$('btnActualizar').addEventListener('click', cargarSolicitudes);

// ==========================================
// DETALLE DE SOLICITUD
// ==========================================

$('solicitudesBody').addEventListener('click', (e) => {

    const boton = e.target.closest('[data-detalle]');

    if (!boton) return;

    const id = boton.dataset.detalle;

    solicitudSeleccionada = solicitudesActuales.find(
        s => String(s.id) === String(id)
    );

    if (!solicitudSeleccionada) return;

    abrirDetalle(solicitudSeleccionada);

});

function abrirDetalle(s) {

    $('detalleTitulo').textContent = s.titulo;

    $('detalleContenido').innerHTML = `

        <div class="detail-row">
            <strong>Número de solicitud</strong>
            #${escapar(s.id)}
        </div>

        <div class="detail-row">
            <strong>Descripción</strong>
            ${escapar(s.descripcion)}
        </div>

        <div class="detail-row">
            <strong>Categoría</strong>
            ${escapar(s.categoria)}
        </div>

        <div class="detail-row">
            <strong>Prioridad</strong>
            ${escapar(textoPrioridad(s.prioridad))}
        </div>

        <div class="detail-row">
            <strong>Estado actual</strong>
            ${escapar(textoEstado(s.estado))}
        </div>

        <div class="detail-row">
            <strong>Fecha de creación</strong>
            ${fechaFormato(s.creado_en)}
        </div>

    `;

    $('adminEstadoGroup').classList.toggle(
        'hidden',
        !esAdministrador
    );

    if (esAdministrador) {
        $('nuevoEstado').value = s.estado;
    }

    $('detalleMessage').textContent = '';
    $('detalleMessage').className = 'message';

    $('detalleModal').classList.remove('hidden');

}

// ==========================================
// CERRAR MODAL
// ==========================================

$('cerrarModal').addEventListener('click', cerrarModal);

$('detalleModal').addEventListener('click', (e) => {

    if (e.target === $('detalleModal')) {
        cerrarModal();
    }

});

function cerrarModal() {
    $('detalleModal').classList.add('hidden');
}

// ==========================================
// ADMINISTRADOR: ACTUALIZAR ESTADO
// ==========================================

$('btnGuardarEstado').addEventListener('click', async () => {

    if (!esAdministrador || !solicitudSeleccionada) return;

    const nuevoEstado = $('nuevoEstado').value;

    const boton = $('btnGuardarEstado');

    boton.disabled = true;
    boton.textContent = 'Guardando...';

    try {

        const { error } = await supabase
            .from('solicitudes')
            .update({
                estado: nuevoEstado,
                actualizado_en: new Date().toISOString()
            })
            .eq('id', solicitudSeleccionada.id);

        if (error) throw error;

        solicitudSeleccionada.estado = nuevoEstado;

        mostrarMensaje(
            'detalleMessage',
            'Estado actualizado correctamente.',
            'success'
        );

        mostrarToast('Solicitud actualizada.');

        await cargarSolicitudes();

        abrirDetalle(solicitudSeleccionada);

    } catch (error) {

        mostrarMensaje(
            'detalleMessage',
            error.message,
            'error'
        );

    } finally {

        boton.disabled = false;
        boton.textContent = 'Guardar cambios';

    }

});

// ==========================================
// ADMINISTRADOR: VER USUARIOS
// ==========================================

async function cargarUsuarios() {

    if (!esAdministrador) return;

    const tbody = $('usuariosBody');

    tbody.innerHTML = `
        <tr>
            <td colspan="4" class="empty-state">
                Cargando usuarios...
            </td>
        </tr>
    `;

    try {

        const { data, error } = await supabase
            .from('usuarios')
            .select('id, nombre, correo, rol, creado_en')
            .in('rol', ['cliente', 'administrador'])
            .order('creado_en', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {

            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="empty-state">
                        No hay usuarios registrados.
                    </td>
                </tr>
            `;

            return;
        }

        tbody.innerHTML = data.map(u => `

            <tr>

                <td>${escapar(u.nombre)}</td>

                <td>${escapar(u.correo)}</td>

                <td>
                    ${u.rol === 'administrador'
                        ? 'Administrador'
                        : 'Cliente'}
                </td>

                <td>${fechaFormato(u.creado_en)}</td>

            </tr>

        `).join('');

    } catch (error) {

        console.error(error);

        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="empty-state">
                    No se pudieron cargar los usuarios.
                </td>
            </tr>
        `;

    }

}

// ==========================================
// CERRAR SESIÓN
// ==========================================

$('btnLogout').addEventListener('click', async () => {

    const { error } = await supabase.auth.signOut();

    if (error) {
        mostrarToast(error.message);
        return;
    }

    usuarioActual = null;
    perfilActual = null;
    esAdministrador = false;
    solicitudesActuales = [];
    solicitudSeleccionada = null;
    tipoAccesoSeleccionado = null;

    $('solicitudForm').reset();

    $('buscarSolicitud').value = '';
    $('filtroEstado').value = '';

    cerrarModal();

    mostrarInicio();

    mostrarToast('Sesión cerrada correctamente.');

});

// ==========================================
// RECUPERAR SESIÓN AL RECARGAR
// ==========================================

async function iniciarAplicacion() {

    const { data, error } = await supabase.auth.getSession();

    if (error) {

        console.error(error);

        mostrarInicio();

        return;
    }

    if (data.session) {

        // Recuperar el rol directamente desde Supabase.

        await cargarPerfil(data.session.user);

    } else {

        mostrarInicio();

    }

}

// ==========================================
// DETECTAR CAMBIOS DE AUTENTICACIÓN
// ==========================================

supabase.auth.onAuthStateChange((event, session) => {

    if (event === 'SIGNED_OUT') {

        usuarioActual = null;
        perfilActual = null;
        esAdministrador = false;
        solicitudesActuales = [];
        solicitudSeleccionada = null;

        mostrarInicio();

    }

});

// ==========================================
// INICIAR APLICACIÓN
// ==========================================

iniciarAplicacion();
