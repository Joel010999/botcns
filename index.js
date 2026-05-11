require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { OpenAI } = require('openai');

const app = express();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE_NAME = 'colegio-bot';

app.use(express.json());

// Ajustamos al puerto 8080 que te asignó Railway en el log
const PORT = process.env.PORT || 8080;

app.post('/webhook', async (req, res) => {
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

            try {
                const response = await openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: 'Sos el asistente virtual del Colegio Nuevo Siglo. Respondé de forma amable, corta y profesional.' },
                        { role: 'user', content: mensajeEntrante }
                    ]
                });

                const respuestaIA = response.choices[0].message.content;
                console.log(`Respuesta IA: ${respuestaIA}`);

                await axios.post(`${EVOLUTION_API_URL}/message/sendText/${INSTANCE_NAME}`, {
                    number: numeroPadre,
                    text: respuestaIA
                }, {
                    headers: {
                        apikey: EVOLUTION_API_KEY
                    }
                });
            } catch (error) {
                console.error('Error procesando con OpenAI o enviando por Evolution API:', error);
            }
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