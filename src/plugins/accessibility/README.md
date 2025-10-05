# Plugin de Accesibilidad para Converse.js

## Descripción

Este plugin mejora significativamente la accesibilidad de Converse.js para usuarios con discapacidades visuales y motoras, incluyendo:

- **Soporte completo para lectores de pantalla** (NVDA, JAWS, VoiceOver, TalkBack, Orca)
- **Navegación completa por teclado** con atajos personalizables
- **Modo de alto contraste** automático o manual
- **Anuncios ARIA en vivo** para eventos importantes
- **Gestión de foco mejorada** para modales y diálogos

## Características principales

### 🎹 Atajos de teclado

El plugin proporciona atajos de teclado intuitivos para todas las funciones principales:

#### Globales
- `Alt+Shift+H` - Mostrar ayuda de atajos
- `Alt+Shift+C` - Enfocar compositor de mensajes
- `Alt+Shift+L` - Enfocar lista de chats
- `Alt+Shift+M` - Ir al último mensaje
- `Alt+Shift+N` - Siguiente chat no leído
- `Alt+Shift+S` - Buscar contactos
- `Escape` - Cerrar modal actual

#### En el compositor
- `Ctrl+Enter` - Enviar mensaje
- `Alt+Shift+E` - Selector de emoji
- `Alt+Shift+F` - Adjuntar archivo

#### En mensajes
- `Alt+↑/↓` - Navegar entre mensajes
- `Alt+Shift+R` - Responder mensaje

### 📢 Anuncios para lectores de pantalla

El plugin anuncia automáticamente:

- Nuevos mensajes entrantes con nombre del remitente
- Cambios de estado de contactos (online, away, etc.)
- Usuarios que se unen/salen de salas
- Errores y notificaciones importantes
- Apertura/cierre de diálogos

### ♿ Mejoras ARIA

Todos los componentes incluyen:

- Roles ARIA semánticos apropiados
- Etiquetas descriptivas (aria-label)
- Regiones live para contenido dinámico
- Estados y propiedades ARIA correctos
- Orden de tabulación lógico

### 🎨 Modo de alto contraste

- Detección automática de preferencias del sistema
- Activación manual disponible
- Mejora de contraste en todos los elementos
- Bordes y contornos más visibles
- Estados de foco mejorados

## Instalación

El plugin está incluido por defecto en Converse.js. Para habilitarlo:

```javascript
converse.initialize({
    enable_accessibility: true,
    enable_keyboard_shortcuts: true,
    enable_screen_reader_announcements: true,
    announce_new_messages: true,
    announce_status_changes: true,
    high_contrast_mode: 'auto'
});
```

## Configuración

### Opciones disponibles

#### `enable_accessibility`
- **Tipo:** `boolean`
- **Default:** `true`
- **Descripción:** Habilita todas las funciones de accesibilidad

#### `enable_keyboard_shortcuts`
- **Tipo:** `boolean`
- **Default:** `true`
- **Descripción:** Habilita los atajos de teclado

#### `enable_screen_reader_announcements`
- **Tipo:** `boolean`
- **Default:** `true`
- **Descripción:** Habilita anuncios para lectores de pantalla

#### `announce_new_messages`
- **Tipo:** `boolean`
- **Default:** `true`
- **Descripción:** Anuncia nuevos mensajes automáticamente

#### `announce_status_changes`
- **Tipo:** `boolean`
- **Default:** `true`
- **Descripción:** Anuncia cambios de estado de contactos

#### `high_contrast_mode`
- **Tipo:** `boolean | 'auto'`
- **Default:** `'auto'`
- **Descripción:** Activa modo de alto contraste

## API para desarrolladores

### Anunciar mensajes

```javascript
converse.api.accessibility.announce(
    'Mensaje importante',
    'assertive' // o 'polite'
);
```

### Gestión de foco

```javascript
const element = document.querySelector('.chat-textarea');
converse.api.accessibility.moveFocus(element, {
    preventScroll: false,
    announce: 'Campo de texto enfocado'
});
```

### Trap de foco (para modales)

```javascript
const modal = document.querySelector('.modal');
const release = converse.api.accessibility.trapFocus(modal);

// Cuando se cierra el modal
release();
```

### Registrar atajos personalizados

```javascript
converse.api.accessibility.registerShortcuts({
    'Ctrl+Alt+X': (event) => {
        console.log('Atajo personalizado');
    }
});
```

### Obtener elementos enfocables

```javascript
const container = document.querySelector('.chat-content');
const focusable = converse.api.accessibility.getFocusableElements(container);
```

## Estructura de archivos

```
src/plugins/accessibility/
├── index.js                  # Plugin principal
├── keyboard-shortcuts.js     # Sistema de atajos
├── modal.js                  # Modal de ayuda
└── styles/
    └── accessibility.scss    # Estilos de accesibilidad

src/utils/
└── accessibility.js          # Utilidades compartidas

src/shared/components/
└── screen-reader-announcer.js # Componente de anuncios
```

## Pruebas

### Lectores de pantalla recomendados

- **Windows:** NVDA (gratis), JAWS (comercial)
- **macOS:** VoiceOver (incluido)
- **Linux:** Orca (gratis)
- **Android:** TalkBack (incluido)
- **iOS:** VoiceOver (incluido)

### Lista de verificación

- [ ] Navegación completa por teclado
- [ ] Todos los elementos interactivos son enfocables
- [ ] Orden de tabulación lógico
- [ ] Etiquetas ARIA apropiadas
- [ ] Anuncios funcionan correctamente
- [ ] Contraste de colores adecuado (WCAG AA)
- [ ] Estados de foco visibles
- [ ] Funciona sin ratón

## Cumplimiento de estándares

Este plugin sigue:

- **WCAG 2.1 Level AA** - Web Content Accessibility Guidelines
- **ARIA 1.2** - Accessible Rich Internet Applications
- **Section 508** - Estándares de accesibilidad de EE.UU.
- **EN 301 549** - Estándares europeos de accesibilidad

## Contribuir

Para mejorar la accesibilidad:

1. Pruebe con tecnologías de asistencia reales
2. Siga las guías ARIA Authoring Practices
3. Use validadores de accesibilidad (axe, WAVE)
4. Documente cambios en accessibility.rst
5. Agregue pruebas automatizadas cuando sea posible

## Recursos

- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM](https://webaim.org/)
- [The A11Y Project](https://www.a11yproject.com/)

## Licencia

MPL-2.0 (igual que Converse.js)

## Soporte

Para reportar problemas de accesibilidad:

1. Abra un issue en GitHub
2. Etiquételo con `accessibility`
3. Incluya:
   - Navegador y versión
   - Tecnología de asistencia usada
   - Pasos para reproducir
   - Comportamiento esperado vs actual

---

**Nota:** La accesibilidad es un proceso continuo. Agradecemos cualquier retroalimentación para mejorar la experiencia de todos los usuarios.
