export default () => ({
    port: parseInt(process.env.APP_PORT ?? '3000', 10),
    nodeEnv: process.env.NODE_ENV ?? 'development',

    database: {
        host: process.env.DB_HOST ?? 'localhost',
        port: parseInt(process.env.DB_PORT ?? '5432', 10),
        username: process.env.DB_USERNAME ?? 'postgres',
        password: process.env.DB_PASSWORD ?? 'postgres',
        database: process.env.DB_DATABASE ?? 'abTesting',
    },

    jwt: {
        accessSecret: process.env.JWT_ACCESS_SECRET ?? 'fallback-access-secret',
        accessExpiration: process.env.JWT_ACCESS_EXPIRATION ?? '1d',
        refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'fallback-refresh-secret',
        refreshExpiration: process.env.JWT_REFRESH_EXPIRATION ?? '7d',
    },

    cookie: {
        secret: process.env.COOKIE_SECRET ?? 'fallback-cookie-secret',
        secure: process.env.COOKIE_SECURE === 'true',
        sameSite: (process.env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none') ?? 'lax',
    },

    // stripe: {
    //     secretKey: process.env.STRIPE_SECRET_KEY,
    //     webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    //     priceIds: {
    //         basic: process.env.STRIPE_PRICE_ID_BASIC,
    //         pro: process.env.STRIPE_PRICE_ID_PRO,
    //     },
    // },
    // razorpay: {
    //     keyId: process.env.RAZORPAY_KEY_ID,
    //     keySecret: process.env.RAZORPAY_KEY_SECRET,
    // },

    redis: {
        host: process.env.REDIS_HOST ,
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
        password: process.env.REDIS_PASSWORD,
        tls: process.env.REDIS_TLS === 'true',
    },

    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
});