import { registerUser, loginUser } from '../../domain/auth/auth.service';
import { asyncHandler } from '../utils/asyncHandler';

export const register = asyncHandler(async (req, res) => {
    const { username, email, password } = req.body;

    const { user, token } = await registerUser({
        username,
        email,
        password,
    });

    res.status(201).json({
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
        },
        accessToken: token,
    });
});

export const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const { user, token } = await loginUser({ email, password });

    res.json({
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
        },
        accessToken: token,
    });
});
