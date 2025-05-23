const tomtomService = require('../services/tomtomService');
const Incident = require('../models/incidentModel');
const { Sequelize, Op } = require('sequelize');

/**
 * Récupère les informations de trafic pour une zone donnée
 * @route GET /api/traffic/info
 */
exports.getTrafficInfo = async (req, res, next) => {
    try {
        const { bbox, zoom } = req.query;

        if (!bbox) {
            return res.status(400).json({
                status: 'error',
                message: 'La boîte englobante (bbox) est requise'
            });
        }

        // Convertir la chaîne bbox en tableau de nombres
        const bboxArray = bbox.split(',').map(Number);

        if (bboxArray.length !== 4) {
            return res.status(400).json({
                status: 'error',
                message: 'La boîte englobante (bbox) doit contenir 4 valeurs [minLon, minLat, maxLon, maxLat]'
            });
        }

        const trafficInfo = await tomtomService.getTrafficInfo({
            bbox: bboxArray,
            zoom: zoom ? parseInt(zoom) : 10
        });

        res.status(200).json({
            status: 'success',
            data: {
                trafficInfo
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Récupère les incidents de trafic pour une zone donnée
 * @route GET /api/traffic/incidents
 */
exports.getTrafficIncidents = async (req, res, next) => {
    try {
        console.log("pass here amigo 1")
        const { bbox, incidentType } = req.query;

        if (!bbox) {
            return res.status(400).json({
                status: 'error',
                message: 'La boîte englobante (bbox) est requise'
            });
        }

        const bboxArray = bbox.split(',').map(Number);

        if (bboxArray.length !== 4) {
            return res.status(400).json({
                status: 'error',
                message: 'La boîte englobante (bbox) doit contenir 4 valeurs [minLon, minLat, maxLon, maxLat]'
            });
        }

        const tomtomIncidents = await tomtomService.getTrafficIncidents({
            bbox: bboxArray,
            incidentType: incidentType || 'all'
        });

        const userIncidents = await Incident.findAll({
            where: {
                location: {
                    [Op.and]: [
                        Sequelize.where(
                            Sequelize.fn('ST_X', Sequelize.col('location')),
                            { [Op.between]: [bboxArray[0], bboxArray[2]] }
                        ),
                        Sequelize.where(
                            Sequelize.fn('ST_Y', Sequelize.col('location')),
                            { [Op.between]: [bboxArray[1], bboxArray[3]] }
                        )
                    ]
                },
                active: true,
                expiresAt: {
                    [Op.gt]: new Date()
                }
            }
        });

        const formattedUserIncidents = userIncidents.map(incident => ({
            id: incident.id,
            type: 'user-report',
            geometry: {
                type: 'Point',
                coordinates: [
                    incident.location.coordinates[0],
                    incident.location.coordinates[1]
                ]
            },
            properties: {
                iconCategory: incident.incidentType,
                magnitudeOfDelay: incident.severity,
                events: [
                    {
                        description: incident.description,
                        code: incident.incidentType,
                        iconCategory: incident.incidentType
                    }
                ],
                startTime: incident.createdAt,
                endTime: incident.expiresAt,
                validations: incident.validations,
                invalidations: incident.invalidations,
                reportedBy: incident.userId
            }
        }));

        const incidents = {
            ...tomtomIncidents,
            incidents: [
                ...tomtomIncidents.incidents,
                ...formattedUserIncidents
            ]
        };

        res.status(200).json({
            status: 'success',
            data: {
                incidents
            }
        });
    } catch (error) {
        console.log(" pass here with errro")
        next(error);
    }
};

/**
 * Signale un nouvel incident de trafic
 * @route POST /api/traffic/report
 */
exports.reportTrafficIncident = async (req, res, next) => {
    try {
        const {
            incidentType,
            coordinates,
            description,
            severity,
            durationMinutes
        } = req.body;

        if (!incidentType || !coordinates) {
            return res.status(400).json({
                status: 'error',
                message: 'Le type d\'incident et les coordonnées sont requis'
            });
        }

        const validTypes = ['accident', 'congestion', 'roadClosed', 'roadworks', 'hazard', 'police'];
        if (!validTypes.includes(incidentType)) {
            return res.status(400).json({
                status: 'error',
                message: 'Type d\'incident invalide'
            });
        }

        const pgPoint = {
            type: 'Point',
            coordinates: coordinates
        };

        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + (durationMinutes || 60));

        const userId = req.headers['x-user-id'];

        const incident = await Incident.create({
            userId,
            incidentType,
            location: pgPoint,
            description: description || '',
            severity: severity || 'moderate',
            validations: 0,
            invalidations: 0,
            active: true,
            expiresAt
        });

        res.status(201).json({
            status: 'success',
            data: {
                incident
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Résolut un incident de trafic
 * @route GET /api/traffic/resolve/:id
 */
exports.resolveTrafficIncident = async (req, res, next) => {
    try {
        const { id } = req.params;

        const incident = await Incident.findByPk(id);

        if (!incident) {
            return res.status(404).json({
                status: 'error',
                message: 'Incident non trouvé'
            });
        }

        incident.active = false;
        await incident.save();

        res.status(200).json({
            status: 'success',
            data: {
                incident
            }
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Récupère les signalements d'incidents créés par les utilisateurs
 * @route GET /api/traffic/reports
 */
exports.getUserReports = async (req, res, next) => {
    try {
        const { bbox, userId, active, incidentType } = req.query;

        const where = {};

        if (userId) {
            where.userId = userId;
        }

        if (active !== undefined) {
            where.active = active === 'true';
        }

        if (incidentType) {
            where.incidentType = incidentType;
        }

        if (bbox) {
            const bboxArray = bbox.split(',').map(Number);

            if (bboxArray.length === 4) {
                where.location = {
                    [Op.and]: [
                        Sequelize.where(
                            Sequelize.fn('ST_X', Sequelize.col('location')),
                            { [Op.between]: [bboxArray[0], bboxArray[2]] }
                        ),
                        Sequelize.where(
                            Sequelize.fn('ST_Y', Sequelize.col('location')),
                            { [Op.between]: [bboxArray[1], bboxArray[3]] }
                        )
                    ]
                };
            }
        }

        const incidents = await Incident.findAll({
            where,
            order: [['createdAt', 'DESC']]
        });

        res.status(200).json({
            status: 'success',
            results: incidents.length,
            data: {
                incidents
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Valide un signalement d'incident
 * @route POST /api/traffic/validate/:id
 */
exports.validateIncidentReport = async (req, res, next) => {
    try {
        const { id } = req.params;

        const incident = await Incident.findByPk(id);

        if (!incident) {
            return res.status(404).json({
                status: 'error',
                message: 'Incident non trouvé'
            });
        }

        incident.validations += 1;
        await incident.save();

        res.status(200).json({
            status: 'success',
            data: {
                incident
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Invalide un signalement d'incident
 * @route POST /api/traffic/invalidate/:id
 */
exports.invalidateIncidentReport = async (req, res, next) => {
    try {
        const { id } = req.params;

        const incident = await Incident.findByPk(id);

        if (!incident) {
            return res.status(404).json({
                status: 'error',
                message: 'Incident non trouvé'
            });
        }

        incident.invalidations += 1;

        if (incident.invalidations >= 3) {
            incident.active = false;
        }

        await incident.save();

        res.status(200).json({
            status: 'success',
            data: {
                incident
            }
        });
    } catch (error) {
        next(error);
    }
};