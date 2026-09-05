import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { t } from "i18next";
import { client } from "../app/runtime";
import { setAuthToken } from "../utils/auth";
import { Input } from "../components/input";
import { ButtonWithLoading } from "../components/button";

function decodeRegistrationToken(token: string): { avatar?: string; suggestedUsername?: string } | null {
    try {
        const payloadSegment = token.split('.')[1];
        if (!payloadSegment) return null;
        const normalized = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
        const json = decodeURIComponent(
            atob(normalized)
                .split('')
                .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        const payload = JSON.parse(json);
        return { avatar: payload.avatar, suggestedUsername: payload.suggestedUsername };
    } catch {
        return null;
    }
}

export function RegisterPage() {
    const [, setLocation] = useLocation();
    const [token, setToken] = useState<string | null>(null);
    const [bindCode, setBindCode] = useState<string | null>(null);
    const [avatar, setAvatar] = useState("");
    const [suggested, setSuggested] = useState("");
    const [username, setUsername] = useState("");
    const [available, setAvailable] = useState<boolean | null>(null);
    const [checking, setChecking] = useState(false);
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tk = params.get('token');
        const code = params.get('code');
        if (!tk) {
            setError(t('register.invalid_token'));
            return;
        }
        setToken(tk);
        setBindCode(code);
        const decoded = decodeRegistrationToken(tk);
        if (decoded) {
            setAvatar(decoded.avatar || "");
            setSuggested(decoded.suggestedUsername || "");
            setUsername(decoded.suggestedUsername || "");
        }
    }, []);

    useEffect(() => {
        if (!username) {
            setAvailable(null);
            return;
        }
        setChecking(true);
        const handle = setTimeout(async () => {
            const { data } = await client.user.checkUsername(username);
            setAvailable(data?.available ?? false);
            setChecking(false);
        }, 400);
        return () => clearTimeout(handle);
    }, [username]);

    const handleSubmit = async () => {
        if (!token) {
            setError(t('register.invalid_token'));
            return;
        }
        if (!username.trim()) {
            setError(t('register.username_required'));
            return;
        }
        if (available === false) {
            setError(t('register.username_taken'));
            return;
        }
        setSubmitting(true);
        setError("");
        const { data, error: apiError } = await client.user.register({ token, username: username.trim() });
        if (apiError) {
            setError(typeof apiError.value === 'string' ? apiError.value : t('register.failed'));
            setSubmitting(false);
            return;
        }
        if (data?.token) {
            setAuthToken(data.token);
        }
        setLocation("/");
        window.location.reload();
    };

    return (
        <div className="flex items-center justify-center my-8">
            <div className="bg-w w-full max-w-md flex flex-col items-center justify-between p-8 space-y-4 t-primary rounded-2xl shadow-lg">
                <p className="text-2xl font-bold">{t('register.title')}</p>

                {error && (
                    <p className="text-sm text-red-500">{error}</p>
                )}

                {bindCode && (
                    <div className="w-full p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
                        <p className="font-medium text-yellow-800">{t('register.bind_code_title')}</p>
                        <p className="text-xs text-yellow-700 mt-1">{t('register.bind_code_hint')}</p>
                        <p className="text-lg font-mono font-bold text-yellow-900 mt-2 select-all">{bindCode}</p>
                    </div>
                )}

                {avatar && (
                    <img src={avatar} alt="avatar" className="w-16 h-16 rounded-full" />
                )}

                <Input
                    value={username}
                    setValue={setUsername}
                    placeholder={t('register.username.placeholder')}
                    disabled={submitting}
                    autofocus
                />

                <p className="text-xs t-secondary">
                    {checking
                        ? t('register.checking')
                        : available === true
                            ? t('register.available')
                            : available === false
                                ? t('register.username_taken')
                                : ""}
                </p>

                <div className="flex flex-row items-center space-x-4 pt-2">
                    <ButtonWithLoading
                        title={submitting ? t("register.submitting") : t("register.submit")}
                        onClick={handleSubmit}
                        loading={submitting}
                    />
                </div>

                {suggested && (
                    <p className="text-xs t-secondary">{t('register.suggested', { name: suggested })}</p>
                )}
            </div>
        </div>
    );
}
