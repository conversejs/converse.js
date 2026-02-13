.. _accessibility:

Accesibilidad
=============

Converse.js está comprometido con proporcionar una experiencia accesible para todos los usuarios, 
incluyendo aquellos que utilizan tecnologías de asistencia como lectores de pantalla o navegación 
exclusiva por teclado.

.. contents:: Tabla de contenidos
   :depth: 3
   :local:

Características de accesibilidad
---------------------------------

Navegación por teclado
~~~~~~~~~~~~~~~~~~~~~~~

Converse.js ofrece soporte completo para navegación por teclado, permitiendo a los usuarios 
interactuar con todas las funciones sin necesidad de un ratón.

Atajos de teclado globales
^^^^^^^^^^^^^^^^^^^^^^^^^^^

Los siguientes atajos de teclado están disponibles en toda la aplicación:

.. list-table::
   :header-rows: 1
   :widths: 30 70

   * - Atajo
     - Descripción
   * - ``Alt+Shift+H``
     - Mostrar/ocultar ayuda de atajos de teclado
   * - ``Alt+Shift+C``
     - Enfocar el área de composición de mensajes
   * - ``Alt+Shift+L``
     - Enfocar la lista de chats
   * - ``Alt+Shift+M``
     - Ir al último mensaje del chat actual
   * - ``Alt+Shift+N``
     - Ir al siguiente chat con mensajes no leídos
   * - ``Alt+Shift+P``
     - Ir al chat anterior en la lista
   * - ``Alt+Shift+S``
     - Enfocar el campo de búsqueda de contactos
   * - ``Escape``
     - Cerrar modal o diálogo abierto

Atajos en el compositor de mensajes
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

Cuando el área de composición de mensajes está enfocada:

.. list-table::
   :header-rows: 1
   :widths: 30 70

   * - Atajo
     - Descripción
   * - ``Ctrl+Enter``
     - Enviar el mensaje actual
   * - ``Alt+Shift+E``
     - Abrir selector de emojis
   * - ``Alt+Shift+F``
     - Abrir selector de archivos para adjuntar

Atajos de navegación en mensajes
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

Para navegar entre mensajes:

.. list-table::
   :header-rows: 1
   :widths: 30 70

   * - Atajo
     - Descripción
   * - ``Alt+↑``
     - Ir al mensaje anterior
   * - ``Alt+↓``
     - Ir al siguiente mensaje
   * - ``Alt+Shift+R``
     - Responder al mensaje enfocado

Lectores de pantalla
~~~~~~~~~~~~~~~~~~~~~

Converse.js incluye soporte completo para lectores de pantalla mediante:

* **Etiquetas ARIA apropiadas**: Todos los elementos interactivos incluyen etiquetas descriptivas
* **Roles ARIA semánticos**: Los componentes utilizan roles apropiados (region, log, toolbar, etc.)
* **Anuncios en vivo**: Los eventos importantes se anuncian automáticamente
* **Navegación lógica**: El orden de tabulación sigue un flujo lógico y predecible

Anuncios automáticos
^^^^^^^^^^^^^^^^^^^^

El lector de pantalla anunciará automáticamente:

* Nuevos mensajes entrantes (con nombre del remitente)
* Cambios de estado de contactos
* Unión/salida de usuarios en salas de chat
* Errores y notificaciones importantes
* Apertura y cierre de diálogos

Configuración
-------------

Opciones de accesibilidad
~~~~~~~~~~~~~~~~~~~~~~~~~~

Puede configurar el comportamiento de accesibilidad mediante las siguientes opciones:

``enable_accessibility``
^^^^^^^^^^^^^^^^^^^^^^^^

* **Tipo**: Boolean
* **Predeterminado**: ``true``
* **Descripción**: Habilita o deshabilita todas las funciones de accesibilidad mejoradas

.. code-block:: javascript

    converse.initialize({
        enable_accessibility: true
    });

``enable_keyboard_shortcuts``
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

* **Tipo**: Boolean
* **Predeterminado**: ``true``
* **Descripción**: Habilita o deshabilita los atajos de teclado

.. code-block:: javascript

    converse.initialize({
        enable_keyboard_shortcuts: true
    });

``enable_screen_reader_announcements``
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

* **Tipo**: Boolean
* **Predeterminado**: ``true``
* **Descripción**: Habilita o deshabilita los anuncios para lectores de pantalla

.. code-block:: javascript

    converse.initialize({
        enable_screen_reader_announcements: true
    });

``announce_new_messages``
^^^^^^^^^^^^^^^^^^^^^^^^^^

* **Tipo**: Boolean
* **Predeterminado**: ``true``
* **Descripción**: Anuncia automáticamente los nuevos mensajes entrantes

.. code-block:: javascript

    converse.initialize({
        announce_new_messages: true
    });

``announce_status_changes``
^^^^^^^^^^^^^^^^^^^^^^^^^^^^

* **Tipo**: Boolean
* **Predeterminado**: ``true``
* **Descripción**: Anuncia los cambios de estado de los contactos

.. code-block:: javascript

    converse.initialize({
        announce_status_changes: true
    });

``high_contrast_mode``
^^^^^^^^^^^^^^^^^^^^^^^

* **Tipo**: Boolean | 'auto'
* **Predeterminado**: ``'auto'``
* **Descripción**: Activa el modo de alto contraste. 'auto' detecta la preferencia del sistema

.. code-block:: javascript

    converse.initialize({
        high_contrast_mode: 'auto'  // o true/false
    });

API de accesibilidad
--------------------

Converse.js expone una API para que los desarrolladores puedan integrar funciones de accesibilidad 
en plugins personalizados.

Anunciar mensajes
~~~~~~~~~~~~~~~~~

Para anunciar un mensaje a los lectores de pantalla:

.. code-block:: javascript

    converse.api.accessibility.announce(
        'Mensaje a anunciar',
        'polite'  // o 'assertive' para mayor prioridad
    );

Gestión de foco
~~~~~~~~~~~~~~~

Mover el foco a un elemento específico:

.. code-block:: javascript

    const element = document.querySelector('.chat-textarea');
    converse.api.accessibility.moveFocus(element, {
        preventScroll: false,
        announce: 'Área de texto enfocada'
    });

Obtener elementos enfocables
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. code-block:: javascript

    const container = document.querySelector('.chat-content');
    const focusableElements = converse.api.accessibility.getFocusableElements(container);

Trap de foco
~~~~~~~~~~~~

Útil para modales y diálogos:

.. code-block:: javascript

    const modal = document.querySelector('.modal');
    const releaseTrap = converse.api.accessibility.trapFocus(modal);
    
    // Cuando se cierre el modal
    releaseTrap();

Registrar atajos personalizados
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. code-block:: javascript

    converse.api.accessibility.registerShortcuts({
        'Ctrl+Alt+X': (event) => {
            // Manejar el atajo
            console.log('Atajo personalizado activado');
        }
    });

Mejores prácticas
-----------------

Para desarrolladores
~~~~~~~~~~~~~~~~~~~~

Si está desarrollando plugins o personalizaciones para Converse.js, siga estas mejores prácticas:

1. **Siempre incluya etiquetas ARIA**

   .. code-block:: html

      <button aria-label="Cerrar chat">×</button>

2. **Use roles semánticos apropiados**

   .. code-block:: html

      <div role="log" aria-live="polite">
        <!-- Mensajes del chat -->
      </div>

3. **Asegure el orden de tabulación lógico**

   Use ``tabindex`` apropiadamente:
   
   * ``tabindex="0"`` para elementos que deben estar en el flujo natural
   * ``tabindex="-1"`` para elementos que deben ser enfocables programáticamente
   * Evite valores positivos de ``tabindex``

4. **Proporcione alternativas textuales**

   .. code-block:: html

      <img src="emoji.png" alt="emoji sonriente" />
      <converse-icon aria-label="Usuario en línea" />

5. **Anuncie cambios dinámicos**

   .. code-block:: javascript

      converse.api.accessibility.announce('Se agregó un nuevo contacto');

6. **Pruebe con lectores de pantalla**

   * NVDA (Windows) - Gratuito
   * JAWS (Windows) - Comercial
   * VoiceOver (macOS/iOS) - Integrado
   * TalkBack (Android) - Integrado
   * Orca (Linux) - Gratuito

Para usuarios
~~~~~~~~~~~~~

Consejos para una mejor experiencia:

1. **Aprenda los atajos de teclado**: Presione ``Alt+Shift+H`` para ver todos los atajos disponibles

2. **Configure su lector de pantalla**: Asegúrese de que su lector de pantalla esté configurado para anunciar regiones ARIA live

3. **Use el modo de navegación apropiado**: En navegadores, use el modo de formulario/foco cuando interactúe con los campos de chat

4. **Ajuste la configuración**: Desactive los anuncios que encuentre molestos mediante las opciones de configuración

Recursos adicionales
--------------------

* `Web Content Accessibility Guidelines (WCAG) <https://www.w3.org/WAI/WCAG21/quickref/>`_
* `ARIA Authoring Practices Guide <https://www.w3.org/WAI/ARIA/apg/>`_
* `WebAIM - Recursos de accesibilidad web <https://webaim.org/>`_

Reportar problemas
------------------

Si encuentra problemas de accesibilidad o tiene sugerencias para mejorar, por favor:

1. Reporte el problema en nuestro `rastreador de issues en GitHub <https://github.com/conversejs/converse.js/issues>`_
2. Etiquete el issue con ``accessibility``
3. Incluya:
   
   * Descripción detallada del problema
   * Navegador y versión
   * Tecnología de asistencia utilizada (si aplica)
   * Pasos para reproducir

Trabajamos continuamente para mejorar la accesibilidad de Converse.js y agradecemos sus comentarios.
