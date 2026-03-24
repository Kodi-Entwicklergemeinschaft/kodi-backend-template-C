const axios = require('axios');
const usersRepository = require('../repository/userRepo');
const cityRepo = require('../repository/cityRepo');
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
const WEATHER_API_URL = 'https://api.weatherapi.com/v1';

/**
 * @desc    Get weather forecast for a location
 * @route   GET /api/v1/third-party/weather
 * @access  Public
 */
const getWeather = async (req, res) => {
    try {
        const { location, days, dt } = req.query;
        const userId = req.userId;
        let cityLocation = null;

        if (userId) {
            try {
                const userData = await usersRepository.getOne({
                    filters: [
                        { key: "id", sign: "=", value: userId }
                    ],
                    columns: "id, cityid"
                });
                
                if (userData?.cityid) {
                    const city = await cityRepo.getOne({
                        filters: [
                            { key: "id", sign: "=", value: userData.cityid }
                        ],
                        columns: "name"
                    });
                    
                    if (city?.name) {
                        cityLocation = city.name;
                    }
                }
            } catch (userError) {
                console.error('Error fetching user city:', userError);
            }
        }

        const params = {
            q: `${cityLocation || location}, Germany`,
            key: WEATHER_API_KEY
        };
        
        // Use dt (date) parameter if provided, otherwise use days
        if (dt) {
            params.dt = dt;
        } else if (days) {
            params.days = days;
        }
        
        const response = await axios.get(`${WEATHER_API_URL}/forecast.json`, {
            params
        });

        res.status(200).json(response.data);
    } catch (error) {
        console.error('Weather API Error:', error.message);
        
        let statusCode = 500;
        let message = 'Server Error';
        
        if (error.response) {
            statusCode = error.response.status;
            message = error.response.data?.error?.message || 'Weather API Error';
        }
        
        res.status(statusCode).json({
            success: false,
            error: message
        });
    }
};

module.exports = {
    getWeather
};