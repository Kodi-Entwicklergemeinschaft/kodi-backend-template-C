const BaseRepo = require("./baseRepo");
const tableNames = require("../constants/tableNames");
const database = require("../utils/database");

class ListingsRepo extends BaseRepo {
    constructor() {
        super(tableNames.LISTINGS_TABLE);
    }

    /**
     * Retrieve listings with optional filters and favorite status.
     * @param {Object} params
     * @param {number|null} params.userId - Authenticated user's ID (optional).
     * @param {Array} params.filters - Additional filters (statusId excluded — handled via statusId param).
     * @param {Array} params.cities - City IDs to filter by.
     * @param {number} params.pageNo - Page number.
     * @param {number} params.pageSize - Page size.
     * @param {string|null} params.searchQuery - Search query.
     * @param {boolean} params.sortByStartDate - Whether to sort by start date.
     * @param {string|null} params.startAfterDate - Filter where startDate >= this date.
     * @param {string|null} params.endBeforeDate - Filter where startDate <= this date.
     * @param {string|null} params.endAfterDate - Filter where endDate >= this date.
     * @param {number|null} params.centerLatitude - Center latitude for proximity filtering.
     * @param {number|null} params.centerLongitude - Center longitude for proximity filtering.
     * @param {number|null} params.radius - Radius for proximity filtering (in km).
     * @param {number|string|null} params.statusId - null=Active(1), '*'=all statuses, number=specific status.
     */
    retrieveListings = async ({
        userId = null,
        filters = [],
        cities = [],
        pageNo = 1,
        pageSize = 10,
        searchQuery = null,
        sortByStartDate = false,
        todayFirstThenAsc = false,
        startAfterDate = null,
        endBeforeDate = null,
        endAfterDate = null,
        centerLatitude = null,
        centerLongitude = null,
        radius = null,
        accessibilityTagIds = [],
        orderByFavoritesCreated = false,
        isFavorite = false,
        statusId = null,
    }) => {
        const queryParams = [];

        // ── Status condition for the city_listing_mappings subquery ──────────
        // Following reference pattern: status is filtered inside the subquery,
        // not as a post-join WHERE filter on L.statusId.
        //   statusId = '*'    → admin mode, no status filter
        //   statusId = number → filter by that specific status
        //   statusId = null   → default: Active only (statusId = 1)
        let statusCondition;
        if (statusId === '*') {
            statusCondition = '';
        } else if (statusId != null) {
            statusCondition = ' AND clm.statusId = ?';
        } else {
            statusCondition = ' AND clm.statusId = 1'; // Active by default
        }

        // ── City filter for the subquery ──────────────────────────────────────
        const cityCondition = cities.length > 0
            ? ` AND clm.cityId IN (${cities.map(() => '?').join(',')})`
            : '';

        // ── Base SELECT ───────────────────────────────────────────────────────
        let query = `
            SELECT
                L.id,
                L.title,
                L.description,
                L.createdAt,
                L.userId,
                L.startDate,
                L.endDate,
                L.latitude,
                L.longitude,
                L.categoryId,
                L.subcategoryId,
                L.showExternal,
                L.appointmentId,
                L.viewCount,
                L.externalId,
                L.expiryDate,
                L.sourceId,
                L.website,
                L.address,
                L.email,
                L.phone,
                L.zipcode,
                L.pdf,
                C.cityId,
                C.cityCount,
                C.allCities,
                C.cityData,
                sub.logo,
                sub.logoCount,
                sub.otherLogos,
                cat.name as categoryName,
                COALESCE(access.accessibilityTags, JSON_ARRAY()) as accessibilityTags`;

        // ── Optional: distance calculation ────────────────────────────────────
        if (
            centerLatitude !== null &&
            centerLongitude !== null &&
            radius !== null
        ) {
            query += `,
                (6371 * ACOS(
                    COS(RADIANS(?)) * COS(RADIANS(L.latitude)) * COS(RADIANS(L.longitude) - RADIANS(?))
                    + SIN(RADIANS(?)) * SIN(RADIANS(L.latitude))
                )) AS distanceKm
            `;
            queryParams.push(centerLatitude, centerLongitude, centerLatitude);
        }

        // ── isFavorite ────────────────────────────────────────────────────────
        if (userId !== null) {
            query += `,
                IF(F.listingId IS NOT NULL, TRUE, FALSE) as isFavorite,
                F.createdAt as favoritesCreatedAt
            `;
        } else {
            query += `,
                FALSE as isFavorite
            `;
        }

        // ── FROM + city_listing_mappings subquery (reference pattern) ─────────
        // • Status + city filtering happens INSIDE the subquery so the INNER JOIN
        //   naturally excludes listings that don't match.
        // • cityData is a rich JSON array built per (filtered) city row.
        // • allCities uses a correlated subquery to always return the full set of
        //   city IDs for a listing, independent of the active city/status filter.
        query += `
            FROM listings L
            INNER JOIN (
                SELECT
                    clm.listingId,
                    MIN(clm.cityId) AS cityId,
                    COUNT(*) AS cityCount,
                    (
                        SELECT JSON_ARRAYAGG(sub_clm.cityId)
                        FROM city_listing_mappings sub_clm
                        WHERE sub_clm.listingId = clm.listingId
                    ) AS allCities,
                    JSON_ARRAYAGG(JSON_OBJECT(
                        'id',            c.id,
                        'name',          c.name,
                        'image',         c.image,
                        'latitude',      c.latitude,
                        'longitude',     c.longitude,
                        'parentCity',    c.parentId,
                        'listingStatus', clm.statusId
                    )) AS cityData
                FROM city_listing_mappings clm
                INNER JOIN cities c ON c.id = clm.cityId
                WHERE 1=1
                ${cityCondition}
                ${statusCondition}
                GROUP BY clm.listingId
            ) C ON L.id = C.listingId
            LEFT JOIN (
                SELECT
                    listingId,
                    MIN(CASE WHEN imageOrder = 1 THEN logo ELSE NULL END) as logo,
                    COUNT(*) as logoCount,
                    JSON_ARRAYAGG(JSON_OBJECT('logo', logo, 'imageOrder', imageOrder, 'id', id, 'listingId', listingId)) as otherLogos
                FROM listing_images
                GROUP BY listingId
            ) sub ON L.id = sub.listingId
            INNER JOIN categories cat ON L.categoryId = cat.id
            LEFT JOIN (
                SELECT
                    lat.listingId,
                    JSON_ARRAYAGG(at.name) as accessibilityTags
                FROM (
                    SELECT DISTINCT listingId, tagId
                    FROM listings_accessibility_tags
                ) lat
                JOIN accessibility_tags at ON lat.tagId = at.id
                GROUP BY lat.listingId
            ) access ON L.id = access.listingId
        `;

        // Push subquery params in SQL order: city IN params first, then statusId
        if (cities.length > 0) {
            queryParams.push(...cities);
        }
        if (statusId != null && statusId !== '*') {
            queryParams.push(statusId);
        }

        // ── Optional favorites JOIN ───────────────────────────────────────────
        if (userId !== null) {
            query += `
                LEFT JOIN favorites F ON F.listingId = L.id AND F.userId = ?
            `;
            queryParams.push(userId);
        }

        // ── WHERE clause ──────────────────────────────────────────────────────
        query += ` WHERE 1=1 `;

        // Accessibility tags filter
        if (accessibilityTagIds.length > 0) {
            query += `
                AND L.id IN (
                    SELECT listingId
                    FROM listings_accessibility_tags
                    WHERE tagId IN (${accessibilityTagIds.map(() => '?').join(',')})
                    GROUP BY listingId
                    HAVING COUNT(DISTINCT tagId) = ?
                )
            `;
            queryParams.push(...accessibilityTagIds);
            queryParams.push(accessibilityTagIds.length);
        }

        // Search filter
        if (searchQuery) {
            query += ` AND (L.title LIKE ? OR L.description LIKE ?) `;
            queryParams.push(`%${searchQuery}%`, `%${searchQuery}%`);
        }

        // Date range filters
        if (startAfterDate && endBeforeDate) {
            query += `AND L.startDate IS NOT NULL AND DATE(L.startDate) BETWEEN ? AND ?`;
            queryParams.push(startAfterDate, endBeforeDate);
        } else if (startAfterDate) {
            query += `AND (L.startDate IS NULL OR DATE(L.startDate) >= ?)`;
            queryParams.push(startAfterDate);
        } else if (endBeforeDate) {
            query += `AND (L.startDate IS NULL OR DATE(L.startDate) <= ?)`;
            queryParams.push(endBeforeDate);
        }
        if (endAfterDate) {
            query += `AND (L.endDate IS NULL OR DATE(L.endDate) >= ?)`;
            queryParams.push(endAfterDate);
        }

        // Default per-category visibility rules (when no explicit date filters)
        const noExplicitDate = !startAfterDate && !endBeforeDate && !endAfterDate;
        if (noExplicitDate) {
            query += ` AND (
                (L.categoryId = 3 AND (L.endDate IS NULL OR DATE(L.endDate) >= CURDATE()))
                OR (L.categoryId = 41 AND DATE(COALESCE(L.startDate, L.createdAt)) >= CURDATE())
                OR (L.categoryId = 13 AND DATE(COALESCE(L.endDate, L.createdAt)) >= CURDATE())
                OR (L.categoryId = 1 AND DATE(L.createdAt) <= CURDATE())
                OR (L.categoryId NOT IN (1, 3, 13, 41))
            )`;
        }

        // Additional filters — statusId is handled by the subquery, skip it here
        filters.forEach((filter) => {
            if (filter.value !== undefined) {
                if (
                    filter.sign.toUpperCase() === 'IN' &&
                    Array.isArray(filter.value) &&
                    filter.value.length > 0
                ) {
                    query += ` AND L.${filter.key} IN (${filter.value.map(() => '?').join(',')}) `;
                    queryParams.push(...filter.value);
                } else {
                    query += ` AND L.${filter.key} = ? `;
                    queryParams.push(filter.value);
                }
            }
        });

        // ── Proximity HAVING ──────────────────────────────────────────────────
        if (
            centerLatitude !== null &&
            centerLongitude !== null &&
            radius !== null
        ) {
            query += ` HAVING distanceKm <= ? `;
            queryParams.push(radius);
        }

        // ── Favorites-only wrap ───────────────────────────────────────────────
        if (isFavorite) {
            query = `SELECT * FROM (${query}) t WHERE t.isFavorite = TRUE`;
        }

        // ── ORDER BY ──────────────────────────────────────────────────────────
        let orderByClause;
        if (isFavorite) {
            orderByClause = sortByStartDate
                ? (todayFirstThenAsc
                    ? ' ORDER BY t.startDate IS NULL ASC, t.startDate ASC, t.createdAt DESC '
                    : ' ORDER BY t.startDate IS NULL ASC, t.startDate DESC, t.createdAt DESC ')
                : ' ORDER BY t.createdAt DESC ';

            if (orderByFavoritesCreated && userId !== null) {
                orderByClause = ' ORDER BY t.favoritesCreatedAt DESC, t.createdAt DESC ';
            }
        } else {
            orderByClause = sortByStartDate
                ? (todayFirstThenAsc
                    ? ' ORDER BY L.startDate IS NULL ASC, L.startDate ASC, L.createdAt DESC '
                    : ' ORDER BY L.startDate IS NULL ASC, L.startDate DESC, L.createdAt DESC ')
                : ' ORDER BY L.createdAt DESC ';

            if (orderByFavoritesCreated && userId !== null) {
                orderByClause = ' ORDER BY F.createdAt DESC, L.createdAt DESC ';
            }
        }

        // ── Pagination ────────────────────────────────────────────────────────
        const paginationQuery = `${query} ${orderByClause} LIMIT ?, ?`;
        const offset = (pageNo - 1) * pageSize;
        queryParams.push(parseInt(offset, 10), parseInt(pageSize, 10));

        try {
            const response = await database.callQuery(paginationQuery, queryParams);
            // Convert numeric isFavorite (0/1) to boolean
            const listings = response.rows.map(({ favoritesCreatedAt, ...listing }) => ({
                ...listing,
                isFavorite: Boolean(listing.isFavorite)
            }));
            return listings;
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('Error retrieving listings');
        }
    };

    /**
     * Retrieve only id, latitude, longitude for listings with valid coordinates,
     * optionally filtered by categories and date rules.
     */
    retrievePoiCoordinates = async ({ statusId = null, categoryIds = [] }) => {
        const params = [];
        let query = `
            SELECT L.id, L.latitude, L.longitude, L.categoryId
            FROM listings L
            WHERE L.latitude IS NOT NULL AND L.latitude <> ''
              AND L.longitude IS NOT NULL AND L.longitude <> ''
        `;

        if (statusId != null) {
            query += ` AND L.statusId = ?`;
            params.push(statusId);
        }

        if (Array.isArray(categoryIds) && categoryIds.length > 0) {
            query += ` AND L.categoryId IN (?)`;
            params.push(categoryIds);
        }

        // Single category-based condition (3,41 use startDate; 13 uses endDate; others allowed)
        query += ` AND (
            (L.categoryId IN (3, 41) AND (L.startDate IS NULL OR DATE(L.startDate) >= CURDATE()))
            OR (L.categoryId = 13 AND DATE(L.endDate) >= CURDATE())
            OR (L.categoryId NOT IN (3, 13, 41))
        )`;

        const response = await database.callQuery(query, params);
        return response.rows || [];
    }
}

module.exports = new ListingsRepo();
