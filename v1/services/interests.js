const AppError = require('../utils/appError');
const interestsRepository = require('../repository/interestsRepo');

const getAllInterests = async function () {
    try {
        const interests = await interestsRepository.getAll({
            filters: [
                {
                    key: 'available',
                    sign: '=',
                    value: true
                }
            ]
        });
        return interests.rows;
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err);
    }
};

module.exports = {
    getAllInterests
};
