import { registerUser, loginUser } from '../../domain/auth/auth.service';
import { asyncHandler } from '../utils/asyncHandler';
import { toAuthResponseDTO } from '../dto';

export const register = asyncHandler(async (req, res) => {
    const { username, email, password } = req.body;

    const result = await registerUser({ username, email, password });
    res.status(201).json(toAuthResponseDTO(result));
});

export const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const result = await loginUser({ email, password });
    res.json(toAuthResponseDTO(result));
});
