const Sentry = require('./instrument.js');
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const AppError = require('./v1/utils/appError');
const errorHandler = require('./v1/utils/errorHandler');
const fileUpload = require('express-fileupload');
const headers = require('./v1/middlewares/headers');
const swaggerUi = require('swagger-ui-express');
const v1Router = require('./v1/routes/index');
const apiDocumentation = require('./docs/docRoot');

// defining the Express app
const app = express();
app.set('trust proxy', 1);

// adding Helmet to enhance your Rest API's security
app.use(helmet());

// using bodyParser to parse JSON bodies into JS objects
app.use(bodyParser.json());

// enabling CORS for all requests
app.use(cors());

// adding morgan to log HTTP requests
app.use(morgan('combined'));

app.use(headers);

const fileUploadOptions = { limits: { fileSize: 25000000 }, abortOnLimit: true };
app.use(fileUpload(fileUploadOptions));

// Hello World Route
app.get('/', (req, res) => {
    const helloMessage = {
        status: 'success',
        message: 'Hello world!! Welcome to HEIDI!!'
    };
    res.send(helloMessage);
});

// Main v1 Route
app.use('/v1', v1Router);

app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', (req, res) => {
    const documentation = apiDocumentation('v1');
    swaggerUi.setup(documentation)(req, res);
});

app.use('/api-docs/*', (req, res) => {
    // Handle 404 for unknown API doc versions
    const docNotFoundMessage = {
        status: 'error',
        message: 'API documentation version not found'
    };
    res.status(404).json(docNotFoundMessage);
});

app.all('*', (req, res, next) => next(new AppError(`The URL ${req.originalUrl} does not exists`, 404)));

Sentry.setupExpressErrorHandler(app);

// Express Error Handler
app.use(errorHandler);

const PORT = process.env.PORT;
// starting the server
app.listen(PORT, () => console.log(`listening on port ${PORT}`));

process.on('uncaughtException', function (err) {
    const currentTime = new Date().toUTCString();
    console.error(`${currentTime}: UncaughtException: ${err.message}\n${err.stack}`);
    process.exit(1);
});
