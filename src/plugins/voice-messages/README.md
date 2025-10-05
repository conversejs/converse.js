# Plugin de Mensajes de Voz para Converse.js

Plugin completamente accesible que permite grabar, enviar y reproducir mensajes de audio en Converse.js con soporte completo para lectores de pantalla y navegación por teclado.

## Características

### 🎤 Grabación de Audio
- **Grabador accesible** con controles claros y anuncios de voz
- **Estados de grabación**: idle, solicitando permiso, grabando, pausado, procesando
- **Controles**: iniciar/detener, pausar/reanudar, cancelar
- **Indicador visual** de tiempo transcurrido y forma de onda animada
- **Límite de duración** configurable (predeterminado: 5 minutos)
- **Detección automática** del mejor formato de audio soportado

### 🔊 Reproducción de Audio
- **Reproductor accesible** con controles completos
- **Barra de progreso** con ARIA y navegación por teclado
- **Control de velocidad**: 0.5x, 0.75x, 1x, 1.25x, 1.5x, 1.75x, 2x
- **Navegación temporal**: adelantar/retroceder 5/10 segundos
- **Visualización** de tiempo actual y duración total
- **Botón de descarga** para guardar el archivo

### ♿ Accesibilidad
- **ARIA completo**: roles, labels, estados y live regions
- **Navegación por teclado**: 15+ atajos específicos
- **Lectores de pantalla**: anuncios de todos los estados y acciones
- **Alto contraste**: estilos optimizados
- **Animaciones reducidas**: respeta prefers-reduced-motion

## Instalación

### 1. Registrar el Plugin

En tu archivo de configuración de Converse.js:

```javascript
converse.plugins.add('converse-voice-messages', {
    dependencies: ['converse-chatview', 'converse-accessibility']
});
```

### 2. Configuración

```javascript
converse.initialize({
    // ... otras opciones ...
    
    // Habilitar mensajes de voz
    enable_voice_messages: true,
    
    // Duración máxima en segundos (5 minutos)
    max_voice_message_duration: 300,
    
    // Calidad de audio (bits por segundo)
    voice_message_bitrate: 128000,
    
    // Formato preferido
    voice_message_mime_type: 'audio/webm;codecs=opus',
    
    // Atajos de teclado
    voice_message_shortcuts: {
        start_recording: 'Alt+Shift+V',
        stop_recording: 'Escape',
        pause_resume: 'Space',
        toggle_playback: 'k',
        skip_forward: 'l',
        skip_backward: 'j'
    }
});
```

### 3. Importar Estilos (si es necesario)

Los estilos se importan automáticamente desde el plugin, pero si necesitas personalizarlos:

```scss
@import 'src/plugins/voice-messages/styles/audio-recorder.scss';
@import 'src/plugins/voice-messages/styles/audio-player.scss';
```

## Uso

### Grabar un Mensaje de Voz

#### Por Interfaz
1. En cualquier chat, presiona el botón de micrófono 🎤 en la barra de herramientas
2. Concede permisos de micrófono cuando se soliciten
3. Habla tu mensaje
4. Presiona el botón de detener ⏹️ para finalizar
5. El mensaje se enviará automáticamente

#### Por Teclado
1. Presiona `Alt+Shift+V` para iniciar la grabación
2. Presiona `Space` para pausar/reanudar
3. Presiona `Escape` o `Enter` para detener y enviar

### Reproducir un Mensaje de Voz

Los mensajes de voz recibidos se muestran con el reproductor automáticamente.

#### Controles del Mouse
- Click en **play/pause** ▶️/⏸️
- Arrastra la **barra de progreso** para buscar
- Click en el selector de **velocidad** para cambiar
- Click en **⏮️/⏭️** para saltar 10 segundos

#### Controles del Teclado
- `Space` o `k`: play/pause
- `←/→`: retroceder/adelantar 5 segundos
- `j/l`: retroceder/adelantar 10 segundos
- `Home/End`: ir al inicio/final
- `↑/↓`: aumentar/disminuir velocidad

## API

### Verificar Soporte

```javascript
if (converse.api.voice_messages.isSupported()) {
    console.log('Tu navegador soporta mensajes de voz');
}
```

### Obtener Formatos Soportados

```javascript
const formats = converse.api.voice_messages.getSupportedMimeTypes();
console.log('Formatos disponibles:', formats);
```

### Obtener Mejor Formato

```javascript
const bestFormat = converse.api.voice_messages.getBestMimeType();
console.log('Usar formato:', bestFormat);
```

### Enviar un Mensaje de Voz Programáticamente

```javascript
const chatbox = converse.chatboxes.get('usuario@ejemplo.com');

// audioBlob es un Blob del audio grabado
// duration es la duración en segundos
await converse.api.voice_messages.send(chatbox, audioBlob, duration);
```

### Detectar si un Mensaje es de Voz

```javascript
const message = chatbox.messages.at(0);
const isVoice = converse.api.voice_messages.isVoiceMessage(message);
```

### Formatear Duración

```javascript
const formatted = converse.api.voice_messages.formatDuration(125);
console.log(formatted); // "2:05"
```

## Componentes Web

### `<converse-audio-recorder>`

Componente para grabar audio.

**Propiedades:**
- `maxDuration` (number): Duración máxima en segundos (default: 300)
- `bitrate` (number): Bits por segundo (default: 128000)

**Eventos:**
- `recording-started`: Se inició la grabación
- `recording-paused`: Grabación pausada
- `recording-resumed`: Grabación reanudada
- `recording-stopped`: Grabación detenida con audio disponible
- `recording-cancelled`: Grabación cancelada sin audio
- `recording-error`: Error durante la grabación

**Ejemplo:**
```javascript
const recorder = document.createElement('converse-audio-recorder');
recorder.maxDuration = 180; // 3 minutos

recorder.addEventListener('recording-stopped', (e) => {
    const { audioBlob, duration } = e.detail;
    console.log('Audio grabado:', audioBlob, 'Duración:', duration);
});

document.body.appendChild(recorder);
```

### `<converse-audio-player>`

Componente para reproducir audio.

**Propiedades:**
- `src` (string): URL del archivo de audio
- `title` (string): Título descriptivo (para ARIA)

**Eventos:**
- `play`: Se inició la reproducción
- `pause`: Se pausó la reproducción
- `ended`: Reproducción finalizada
- `timeupdate`: Actualización del tiempo (evento nativo)
- `error`: Error al cargar o reproducir

**Ejemplo:**
```javascript
const player = document.createElement('converse-audio-player');
player.src = 'https://ejemplo.com/audio.webm';
player.title = 'Mensaje de Juan';

player.addEventListener('ended', () => {
    console.log('Reproducción finalizada');
});

document.body.appendChild(player);
```

## Atajos de Teclado

### Globales (en cualquier chat)
- `Alt+Shift+V`: Iniciar grabación de mensaje de voz

### Durante la Grabación
- `Space`: Pausar/reanudar grabación
- `Enter`: Detener y enviar
- `Escape`: Cancelar grabación

### Durante la Reproducción
- `Space` o `k`: Reproducir/pausar
- `←` (flecha izquierda): Retroceder 5 segundos
- `→` (flecha derecha): Adelantar 5 segundos
- `j`: Retroceder 10 segundos
- `l`: Adelantar 10 segundos
- `Home`: Ir al inicio
- `End`: Ir al final
- `↑` (flecha arriba): Aumentar velocidad
- `↓` (flecha abajo): Disminuir velocidad

## Compatibilidad

### Navegadores Soportados

| Navegador | Versión Mínima | Notas |
|-----------|---------------|-------|
| Chrome | 49+ | Soporte completo |
| Firefox | 25+ | Soporte completo |
| Safari | 14.1+ | Requiere prefijo webkit |
| Edge | 79+ | Soporte completo |
| Opera | 36+ | Soporte completo |

### Formatos de Audio

El plugin detecta automáticamente los formatos soportados en orden de preferencia:

1. **audio/webm;codecs=opus** (preferido - mejor compresión)
2. **audio/ogg;codecs=opus**
3. **audio/webm**
4. **audio/ogg**
5. **audio/mp4**
6. **audio/mpeg**

### APIs Requeridas

- **MediaDevices API**: Para acceder al micrófono
- **MediaRecorder API**: Para grabar audio
- **Web Audio API**: Para análisis y procesamiento (opcional)

### Verificar Requisitos

```javascript
const isSupported = !!(
    navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia &&
    window.MediaRecorder
);

if (!isSupported) {
    console.error('Tu navegador no soporta grabación de audio');
}
```

## Permisos

El plugin solicita automáticamente el permiso de micrófono cuando el usuario intenta grabar. Es recomendable informar al usuario sobre esto en tu política de privacidad.

### Manejo de Permisos Denegados

```javascript
recorder.addEventListener('recording-error', (e) => {
    const { error } = e.detail;
    
    if (error.name === 'NotAllowedError') {
        alert('Necesitas conceder acceso al micrófono para grabar mensajes de voz');
    }
});
```

## Personalización

### Estilos CSS

Todas las clases CSS están disponibles para personalización:

```scss
// Cambiar color del indicador de grabación
.recording-indicator {
    background-color: #ff0000 !important;
}

// Personalizar botones
.btn-player {
    border-radius: 8px !important;
    background-color: var(--mi-color-primario) !important;
}

// Cambiar forma de onda
.waveform-bar {
    background: linear-gradient(to top, #667eea, #764ba2) !important;
}
```

### Variables CSS

```css
:root {
    --focus-outline-color: #0066cc;
    --primary-color: #0066cc;
    --primary-color-light: #4d9fff;
    --danger-color: #dc3545;
    --warning-color: #ffc107;
    --success-color: #28a745;
}
```

## Accesibilidad Detallada

### ARIA

El plugin implementa:
- **Roles**: `region`, `toolbar`, `button`, `slider`
- **Labels**: Descriptivos en español para todos los controles
- **Estados**: `aria-pressed`, `aria-disabled`, `aria-valuenow`
- **Live Regions**: Para anunciar cambios dinámicos

### Lectores de Pantalla

Todos los estados se anuncian claramente:
- "Grabación iniciada"
- "Grabación pausada"
- "Grabando: 1 minuto 30 segundos"
- "Mensaje de voz enviado"
- "Reproduciendo al 50%"
- "Velocidad de reproducción: 1.5x"

### Navegación por Teclado

- Todos los controles son accesibles por Tab
- Indicadores de foco visibles
- Atajos de teclado intuitivos
- Tecla Escape para cancelar

### Alto Contraste

Estilos especiales para modo de alto contraste:
```scss
body.converse-high-contrast {
    .audio-player {
        border-width: 3px;
        border-color: #000;
    }
}
```

## Solución de Problemas

### El micrófono no funciona

1. Verifica que el sitio use HTTPS (requerido)
2. Revisa los permisos del navegador
3. Comprueba que el micrófono esté conectado
4. Prueba en otro navegador

### El audio no se reproduce

1. Verifica que el formato sea soportado
2. Comprueba la URL del archivo
3. Revisa la consola por errores CORS
4. Prueba con otro archivo de audio

### Mala calidad de audio

1. Aumenta el bitrate en la configuración
2. Usa un mejor micrófono
3. Graba en un ambiente silencioso
4. Considera usar un formato sin pérdida (si está disponible)

### Errores de consola

```javascript
// Habilitar logs de depuración
console.debug('Voice messages plugin state:', {
    supported: converse.api.voice_messages.isSupported(),
    formats: converse.api.voice_messages.getSupportedMimeTypes(),
    config: {
        enabled: converse.api.settings.get('enable_voice_messages'),
        maxDuration: converse.api.settings.get('max_voice_message_duration')
    }
});
```

## Contribuir

Para contribuir al plugin:

1. Fork el repositorio
2. Crea una rama para tu feature
3. Asegúrate de que los tests pasen
4. Sigue las guías de estilo
5. Crea un Pull Request

### Ejecutar Tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

## Licencia

Mozilla Public License (MPLv2)

## Créditos

Desarrollado con ❤️ para la comunidad de Converse.js con enfoque en accesibilidad universal.

## Soporte

- **Documentación**: https://conversejs.org
- **Issues**: https://github.com/conversejs/converse.js/issues
- **Chat**: converse@conference.conversejs.org

## Changelog

### v1.0.0 (2024)
- ✨ Lanzamiento inicial
- 🎤 Grabación de mensajes de voz
- 🔊 Reproductor con controles completos
- ♿ Soporte completo de accesibilidad
- ⌨️ 15+ atajos de teclado
- 🎨 Temas y personalización
- 🌍 Internacionalización (ES)
