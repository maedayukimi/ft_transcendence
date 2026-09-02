if (!process.env.JWT_SECRET) {
    throw new Error(
        'JWT_SECRET environment variable is not set. Copy .env.example to .env and fill it in.',
    );
}

export const jwtConstants = {
    secret: process.env.JWT_SECRET,
};