const express = require('express');
const app = express();

app.use(express.json());

// Ajustamos al puerto 8080 que te asignó Railway en el log
const PORT = process.env.PORT || 8080;

app.post('/webhook', (req, res) => {
    const body = req.body;

    // 1. Validamos que el evento sea la llegada de un mensaje
    if (body.event === 'messages.upsert') {
        const data = body.data;

        // 2. Filtro de seguridad: ignorar mensajes enviados por el propio bot
        if (data.key.fromMe) {
            return res.status(200).send('EVENT_RECEIVED');
        }

        // 3. Extraemos la información útil
        const numeroPadre = data.key.remoteJid;
        const nombrePadre = data.pushName;

        let mensajeEntrante = '';

        // Evolution API manda el texto plano en 'conversation'
        if (data.message && data.message.conversation) {
            mensajeEntrante = data.message.conversation;
        }
        // Si mandan un emoji o texto citado, puede venir en 'extendedTextMessage'
        else if (data.message && data.message.extendedTextMessage && data.message.extendedTextMessage.text) {
            mensajeEntrante = data.message.extendedTextMessage.text;
        }

        // 4. Imprimimos el resultado limpio
        if (mensajeEntrante) {
            console.log(`Mensaje de ${nombrePadre} (${numeroPadre}): ${mensajeEntrante}`);
        } else {
            console.log(`Se recibió un archivo, audio o formato no soportado de ${nombrePadre}`);
        }
    }

    // Siempre devolver 200 rápido para que Evolution no reintente el envío
    res.status(200).send('EVENT_RECEIVED');
});

app.listen(PORT, () => {
    console.log(`Servidor Express de RenderByte escuchando en el puerto ${PORT}`);
});