import {
    Body,
    Controller,
    Post,
    Request,
    Response,
    Route,
    Security,
    SuccessResponse,
    Tags,
} from 'tsoa';
import type {
    Request as ExpressRequest,
    Response as ExpressResponse,
} from 'express';

import { env } from '../../config/env';
import { registerUser, loginUser } from '../../domain/auth/auth.service';
import {
    signAccessToken,
    signRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
} from '../../domain/auth/token.service';

import { apiError } from '../errors/ApiError';
import {
    toAuthResponseDTO,
    type AuthResponseDTO,
    type RegisterBodyDTO,
    type LoginBodyDTO,
} from '../dto/auth.dto';
import type { ErrorEnvelopeDTO } from '../dto/error.dto';
import type { OkDTO } from '../dto/common.dto';
import { registerSchema, loginSchema } from '../schemas/auth.schemas';
import { revokeToken } from '../../domain/auth/tokenBlacklist.service';

@Route('auth')
@Tags('Auth')
export class AuthController extends Controller {
    @Post('register')
    @SuccessResponse(201, 'Created')
    @Response<ErrorEnvelopeDTO>(400, 'Validation error', {
        error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request',
            details: {
                issues: [{ path: ['email'], message: 'Invalid email' }],
            },
        },
    })
    public async register(
        @Body() body: RegisterBodyDTO,
        @Request() req: ExpressRequest,
    ): Promise<AuthResponseDTO> {
        const data = registerSchema.parse(body);
        const result = await registerUser(data);

        const res = this.mustGetRes(req);
        this.setAuthCookies(res, result.token, result.refreshToken);

        this.setStatus(201);
        return toAuthResponseDTO({ user: result.user });
    }

    @Post('login')
    @Response<ErrorEnvelopeDTO>(400, 'Validation error', {
        error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request',
            details: {
                issues: [{ path: ['email'], message: 'Invalid email' }],
            },
        },
    })
    @Response<ErrorEnvelopeDTO>(401, 'Invalid credentials', {
        error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
        },
    })
    public async login(
        @Body() body: LoginBodyDTO,
        @Request() req: ExpressRequest,
    ): Promise<AuthResponseDTO> {
        const data = loginSchema.parse(body);
        const result = await loginUser(data);

        const res = this.mustGetRes(req);
        this.setAuthCookies(res, result.token, result.refreshToken);

        return toAuthResponseDTO({ user: result.user });
    }

    @Post('refresh')
    public async refresh(@Request() req: ExpressRequest): Promise<OkDTO> {
        const refreshToken = (req as any).cookies?.refreshToken as
            | string
            | undefined;

        if (!refreshToken) {
            throw apiError(401, 'UNAUTHORIZED', 'Missing refresh token');
        }

        let payload;
        try {
            payload = await verifyRefreshToken(refreshToken);
        } catch {
            throw apiError(401, 'UNAUTHORIZED', 'Invalid refresh token');
        }

        // rotate refresh: revoke old refresh token by jti until exp
        await revokeToken({
            kind: 'refresh',
            jti: payload.jti,
            exp: payload.exp,
        });

        const newAccess = signAccessToken({ sub: payload.sub });
        const newRefresh = signRefreshToken({ sub: payload.sub });

        const res = this.mustGetRes(req);
        this.setAuthCookies(res, newAccess, newRefresh);

        return { status: 'ok' };
    }

    @Post('logout')
    @Security('cookieAuth')
    public async logout(@Request() req: ExpressRequest): Promise<OkDTO> {
        const accessToken = (req as any).cookies?.accessToken as
            | string
            | undefined;
        const refreshToken = (req as any).cookies?.refreshToken as
            | string
            | undefined;

        if (accessToken) {
            try {
                const p = await verifyAccessToken(accessToken);
                await revokeToken({ kind: 'access', jti: p.jti, exp: p.exp });
            } catch {
                // ignore
            }
        }

        if (refreshToken) {
            try {
                const p = await verifyRefreshToken(refreshToken);
                await revokeToken({ kind: 'refresh', jti: p.jti, exp: p.exp });
            } catch {
                // ignore
            }
        }

        const res = this.mustGetRes(req);
        this.clearAuthCookies(res);
        return { status: 'ok' };
    }

    // ---------------- helpers ----------------

    private mustGetRes(req: ExpressRequest): ExpressResponse {
        const res = (req as any).res as ExpressResponse | undefined;
        if (!res) {
            throw apiError(500, 'INTERNAL', 'Response object is not available');
        }
        return res;
    }

    private setAuthCookies(
        res: ExpressResponse,
        accessToken: string,
        refreshToken: string,
    ) {
        const isProd = env.NODE_ENV === 'production';

        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: isProd,
            sameSite: 'lax',
            path: '/',
            maxAge: env.JWT_EXPIRES_IN * 1000,
        });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: isProd,
            sameSite: 'lax',
            path: '/',
            maxAge: env.JWT_REFRESH_EXPIRES_IN * 1000,
        });
    }

    private clearAuthCookies(res: ExpressResponse) {
        res.cookie('accessToken', '', { path: '/', maxAge: 0 });
        res.cookie('refreshToken', '', { path: '/', maxAge: 0 });
    }
}
