const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Middleware para parsear JSON
app.use(express.json());

// Ruta GET para la verificación del webhook de WhatsApp
app.get('/webhook', (req, res) => {
    const verify_token = process.env.VERIFY_TOKEN || 'token_seguro_nuevo_siglo';
    
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === verify_token) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    } else {
        res.status(400).send('Faltan parámetros de verificación');
    }
});

// Ruta POST para recibir los mensajes
app.post('/webhook', (req, res) => {
    console.log('Mensaje recibido:', JSON.stringify(req.body, null, 2));
    // Es importante devolver un 200 OK rápidamente para que WhatsApp sepa que se recibió el evento
    res.status(200).send('EVENT_RECEIVED');
});

app.listen(port, () => {
    console.log(`Servidor Express escuchando en el puerto ${port}`);
});
