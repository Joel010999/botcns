require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { OpenAI } = require('openai');
const { Pool } = require('pg');

const app = express();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Configuración de la base de datos
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE_NAME = 'colegio-bot';

app.use(express.json());
const PORT = process.env.PORT || 8080;

// Definición de la herramienta para OpenAI
const tools = [
    {
        type: "function",
        function: {
            name: "consultarDeuda",
            description: "Consulta el estado de deuda de un alumno usando su número de documento (DNI).",
            parameters: {
                type: "object",
                properties: {
                    dni: { type: "string", description: "El DNI del alumno (sin puntos ni espacios)." }
                },
                required: ["dni"]
            }
        }
    }
];

// Función que realmente va a Postgres
async function ejecutarConsultaDeuda(dni) {
    const query = `
        SELECT 
            a.nombres, 
            a.apellido, 
            r.monto, 
            r.estado, 
            r.periodo 
        FROM portal_alumno a
        INNER JOIN portal_registrodeuda r ON a.documento = r.alumno_id
        WHERE a.documento = $1;
    `;
    const res = await pool.query(query, [dni]);
    return res.rows;
}

const promptSistema = `Sos el asistente virtual del Colegio Nuevo Siglo. 
Tu tono es profesional, amable y resolutivo.
Si un usuario te saluda, pedile el DNI del alumno para consultar su estado.
Cuando tengas los datos de deuda, informalos de forma clara (periodo, monto y estado).
Si el alumno no tiene deuda, felicitalo por estar al día.
REGLA: Solo podés dar información si usás la herramienta 'consultarDeuda'.`;

app.post('/webhook', async (req, res) => {
    const body = req.body;

    if (body.event === 'messages.upsert' && !body.data.key.fromMe) {
        const numeroPadre = body.data.key.remoteJid;
        const mensajeEntrante = body.data.message?.conversation || body.data.message?.extendedTextMessage?.text;

        if (mensajeEntrante) {
            try {
                // 1. Primer llamado a OpenAI para ver si necesita la función
                let response = await openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    temperature: 0.2,
                    messages: [
                        { role: 'system', content: promptSistema },
                        { role: 'user', content: mensajeEntrante }
                    ],
                    tools: tools
                });

                let message = response.choices[0].message;

                // 2. Si la IA quiere usar la función (tool_calls)
                if (message.tool_calls) {
                    const toolCall = message.tool_calls[0];
                    const { dni } = JSON.parse(toolCall.function.arguments);

                    console.log(`Consultando deuda para DNI: ${dni}`);
                    const datosDeuda = await ejecutarConsultaDeuda(dni);

                    // 3. Le pasamos el resultado de la DB de vuelta a la IA
                    response = await openai.chat.completions.create({
                        model: 'gpt-4o-mini',
                        messages: [
                            { role: 'system', content: promptSistema },
                            { role: 'user', content: mensajeEntrante },
                            message,
                            {
                                role: 'tool',
                                tool_call_id: toolCall.id,
                                content: JSON.stringify(datosDeuda)
                            }
                        ]
                    });
                }

                const respuestaFinal = response.choices[0].message.content;

                // 4. Enviar respuesta por WhatsApp
                await axios.post(`${EVOLUTION_API_URL}/message/sendText/${INSTANCE_NAME}`, {
                    number: numeroPadre,
                    text: respuestaFinal
                }, { headers: { apikey: EVOLUTION_API_KEY } });

            } catch (error) {
                console.error('Error en el flujo:', error);
            }
        }
    }
    res.status(200).send('EVENT_RECEIVED');
});

app.listen(PORT, () => console.log(`Servidor de RenderByte operativo en puerto ${PORT}`));