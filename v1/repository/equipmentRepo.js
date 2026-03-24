const BaseRepo = require("./baseRepo");
const tableNames = require("../constants/tableNames");
const locationRepo = require("./locationRepo");

class EquipmentRepo extends BaseRepo {
    constructor() {
        super(tableNames.EQUIPMENT_TABLE);
    }

    async getEquipmentBySlug(slug) {
        try {
            const result = await this.getOne({
                filters: [{
                    key: "qrCodeIdentifier",
                    sign: "=",
                    value: slug,
                }]
            });
            return result;
        } catch (error) {
            console.error('Error getting equipment by slug:', error);
            throw error;
        }
    }

    async getEquipmentById(id) {
        try {
            const result = await this.getOne({
                filters: [{
                    key: "id",
                    sign: "=",
                    value: id,
                }]
            });
            return result;
        } catch (error) {
            console.error('Error getting equipment by ID:', error);
            throw error;
        }
    }

    async getAllEquipmentForParcours(count = 5) {
        try {
            // Get equipment with location details in a single query using JOIN
            const { rows } = await this.getAll({
                select: [
                    'equipment.id',
                    'equipment.name',
                    'equipment.muscleGroup',
                    'equipment.locationId',
                    'equipment.machineImageUrls',
                    'equipment.description',
                    'equipment.recommendedSets',
                    'equipment.recommendedReps',
                    'equipment.minReps',
                    'equipment.minSets',
                    'equipment.qrCodeIdentifier'
                ],
                orderBy: ['equipment.locationId', 'equipment.id']
            });
            // Group equipment by location with limit of 5 per location
            // Get all unique location IDs first
            const locationIds = [...new Set(rows.map(eq => eq.locationId).filter(Boolean))];

            // Fetch all locations in one query
            const locations = await locationRepo.getAll({
                filters: { id: { in: locationIds } }
            });
            // Create lookup map
            const locationMap = {};
            const locationMapUrls = {};
            locations.rows.forEach(location => {
                locationMap[location.id] = location.name;
                locationMapUrls[location.id] = location.mapImageUrl;
            });
            const equipmentByLocation = {};
            const locationCounts = {};

            for (const equipment of rows) {
                const locationName = locationMap[equipment.locationId] || 'No Location';

                if (!equipmentByLocation[locationName]) {
                    equipmentByLocation[locationName] = [];
                    locationCounts[locationName] = 0;
                }

                if (locationCounts[locationName] < count) {
                    equipmentByLocation[locationName].push({
                        id: equipment.id,
                        name: equipment.name,
                        muscleGroup: equipment.muscleGroup,
                        machineImageUrl: equipment.machineImageUrls,
                        description: equipment.description,
                        recommendedSets: equipment.recommendedSets,
                        recommendedReps: equipment.recommendedReps,
                        minReps: equipment.minReps,
                        minSets: equipment.minSets,
                        qrCodeIdentifier: equipment.qrCodeIdentifier
                    });
                    locationCounts[locationName]++;
                }
            }
            return { equipmentByLocation, locationMap, locationMapUrls };
        } catch (error) {
            console.error('Error getting equipment for parcours:', error);
            throw error;
        }
    }
}

module.exports = new EquipmentRepo();