import { t } from "i18next";
import { useContext, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Modal } from "@rin/ui";
import { ButtonWithLoading } from "../components/button";
import { client } from "../app/runtime";
import { ImageUploadInput } from "../components/image-upload-input";
import { Input } from "../components/input";
import { Icon } from "../components/icon";
import { GiteeIcon } from "../components/gitee-icon";
import { ProfileContext } from "../state/profile";


export function ProfilePage() {
    const profile = useContext(ProfileContext);
    const [, setLocation] = useLocation();
    const [username, setUsername] = useState('');
    const [avatar, setAvatar] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [linkedAccounts, setLinkedAccounts] = useState<Array<{ provider: string; providerId: string; linkedAt: string }>>([]);
    const [loadingAccounts, setLoadingAccounts] = useState(false);
    const [totpEnabled, setTotpEnabled] = useState(false);
    const [totpModalOpen, setTotpModalOpen] = useState(false);
    const [totpSecret, setTotpSecret] = useState('');
    const [totpCode, setTotpCode] = useState('');
    const [totpLoading, setTotpLoading] = useState(false);
    const [totpError, setTotpError] = useState('');

    // Load current profile data and redirect to login if not authenticated
    useEffect(() => {
        if (profile === undefined) {
            // Still loading, wait
            return;
        }
        if (profile === null) {
            // Not authenticated, redirect to login
            setLocation('/login');
            return;
        }
        // Load current profile data
        setUsername(profile.name || '');
        setAvatar(profile.avatar || '');
        loadLinkedAccounts();
        loadTotpStatus();
    }, [profile, setLocation]);

    const loadLinkedAccounts = async () => {
        setLoadingAccounts(true);
        try {
            const response = await client.user.getLinkedAccounts();
            if (response.data?.accounts) {
                setLinkedAccounts(response.data.accounts);
            }
        } catch (err) {
            // Silent fail for linked accounts loading
        } finally {
            setLoadingAccounts(false);
        }
    };

    const loadTotpStatus = async () => {
        try {
            const response = await client.user.getTotpStatus();
            if (response.data) {
                setTotpEnabled(!!response.data.enabled);
            }
        } catch (err) {
            // Silent fail for TOTP status loading
        }
    };

    const handleOpenTotpModal = async () => {
        setTotpError('');
        setTotpCode('');
        setTotpSecret('');
        setTotpLoading(true);
        setTotpModalOpen(true);
        try {
            const { data, error: apiError } = await client.user.setupTotp();
            if (apiError || !data?.secret) {
                setTotpError(t('profile.totp.setup_failed'));
                return;
            }
            setTotpSecret(data.secret);
        } catch (err) {
            setTotpError(t('profile.totp.setup_failed'));
        } finally {
            setTotpLoading(false);
        }
    };

    const handleConfirmTotp = async () => {
        if (!/^\d{6}$/.test(totpCode.trim())) {
            setTotpError(t('profile.totp.invalid_code'));
            return;
        }
        setTotpLoading(true);
        setTotpError('');
        try {
            const { error: apiError } = await client.user.confirmTotp(totpCode.trim());
            if (apiError) {
                setTotpError(t('profile.totp.confirm_failed'));
                return;
            }
            setTotpEnabled(true);
            setTotpModalOpen(false);
            setSuccess(t('profile.totp.bind_success'));
        } catch (err) {
            setTotpError(t('profile.totp.confirm_failed'));
        } finally {
            setTotpLoading(false);
        }
    };

    const handleUnbindTotp = async () => {
        if (!confirm(t('profile.totp.unbind_confirm'))) {
            return;
        }
        setTotpLoading(true);
        setError('');
        try {
            const { error: apiError } = await client.user.unbindTotp();
            if (apiError) {
                setError(t('profile.totp.unbind_failed'));
                return;
            }
            setTotpEnabled(false);
            setSuccess(t('profile.totp.unbind_success'));
        } catch (err) {
            setError(t('profile.totp.unbind_failed'));
        } finally {
            setTotpLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!username.trim()) {
            setError(t('profile.error.empty_username'));
            return;
        }

        setIsLoading(true);
        setError('');
        setSuccess('');

        try {
            const { error: apiError } = await client.user.updateProfile({ 
                username: username.trim(),
                avatar: avatar || null
            });

            if (apiError) {
                setError(t('profile.error.update_failed'));
                setIsLoading(false);
                return;
            }

            setSuccess(t('profile.success'));
            // Refresh page to update profile context
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (err) {
            setError(t('profile.error.network'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleBind = (provider: string) => {
        if (provider === 'email') {
            const email = prompt(t('profile.bind_email_prompt') || 'Enter your email:');
            if (!email) return;
            
            client.auth.sendEmailCode({ email }).then(({ error }) => {
                if (error) {
                    setError(t('profile.bind_email_send_failed'));
                    return;
                }
                const code = prompt(t('profile.bind_email_code_prompt') || 'Enter verification code:');
                if (!code) return;
                
                client.user.bindAccount(provider, { email, code }).then(({ error }) => {
                    if (error) {
                        setError(t('profile.bind_failed'));
                        return;
                    }
                    setSuccess(t('profile.bind_success', { provider: t(`login.${provider}`) }));
                    loadLinkedAccounts();
                });
            });
        } else if (provider === 'wechat') {
            client.user.getWechatLoginUrl(true).then(({ data }) => {
                if (data?.url) {
                    window.open(data.url, '_blank');
                }
            });
        } else {
            const bindCode = prompt(t('profile.bind_code_prompt') || 'Enter bind code:');
            if (!bindCode) return;
            
            client.user.verifyBindCode(bindCode.trim()).then(({ error }) => {
                if (error) {
                    setError(t('profile.bind_failed'));
                    return;
                }
                setSuccess(t('profile.bind_success', { provider: t(`login.${provider}`) }));
                loadLinkedAccounts();
            });
        }
    };

    const handleGetBindCode = async (provider: string) => {
        if (provider === 'wechat') {
            const { data } = await client.user.getWechatLoginUrl(true);
            if (data?.url) {
                window.open(data.url, '_blank');
            }
        } else {
            const endpoint = provider === 'qq' ? 'xinyueqq' : provider;
            window.open(`/api/user/${endpoint}?bind=true`, '_blank');
        }
    };

    const handleUnbind = async (provider: string) => {
        if (!confirm(t('profile.unbind_confirm', { provider: t(`login.${provider}`) }))) {
            return;
        }

        setIsLoading(true);
        setError('');
        setSuccess('');

        try {
            const { error: apiError } = await client.user.unbindAccount(provider);
            if (apiError) {
                setError(t('profile.unbind_failed'));
                setIsLoading(false);
                return;
            }
            setSuccess(t('profile.unbind_success', { provider: t(`login.${provider}`) }));
            loadLinkedAccounts();
        } catch (err) {
            setError(t('profile.unbind_failed'));
        } finally {
            setIsLoading(false);
        }
    };

    const isProviderBound = (provider: string) => {
        return linkedAccounts.some(account => account.provider === provider);
    };

    const providers = [
        { key: 'github', label: 'GitHub', icon: 'ri-github-fill' },
        { key: 'gitee', label: 'Gitee', icon: '' },
        { key: 'qq', label: 'QQ', icon: 'ri-qq-fill' },
        { key: 'wechat', label: 'WeChat', icon: 'ri-wechat-fill' },
        { key: 'email', label: 'Email', icon: 'ri-mail-fill' },
    ];

    if (profile === undefined) {
        return (
            <div className="py-8 px-4 my-32 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-theme"></div>
            </div>
        );
    }

    if (profile === null) {
        return null;
    }

    return (
        <div className="py-8 px-4 my-8">
            <div className="max-w-2xl mx-auto bg-w rounded-2xl shadow-lg p-8">
                <h1 className="text-2xl font-bold mb-8 t-primary">{t('profile.title')}</h1>

                {/* Error message */}
                {error && (
                    <p className="text-sm text-red-500 mb-4">{error}</p>
                )}

                {/* Success message */}
                {success && (
                    <p className="text-sm text-green-500 mb-4">{success}</p>
                )}

                <div className="space-y-6">
                    {/* Avatar section */}
                    <div className="flex flex-col items-start space-y-4">
                        <label className="text-sm font-medium t-secondary">{t('profile.avatar')}</label>
                        <div className="w-full max-w-xl">
                            <ImageUploadInput
                                value={avatar}
                                onChange={(value) => {
                                    setError('');
                                    setAvatar(value);
                                }}
                                onError={setError}
                                disabled={isLoading}
                                shape="circle"
                                maxFileSize={2 * 1024 * 1024}
                                placeholder={t('upload.image.url_placeholder')}
                            />
                        </div>
                        <p className="text-left text-xs t-secondary">{t('profile.avatar_hint')}</p>
                    </div>

                    {/* Username section */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium t-secondary">{t('profile.username')}</label>
                        <Input
                            value={username}
                            setValue={setUsername}
                            placeholder={t('profile.username_placeholder')}
                            disabled={isLoading}
                        />
                    </div>

                    {/* Linked Accounts section */}
                    <div className="space-y-4">
                        <label className="text-sm font-medium t-secondary">{t('profile.linked_accounts')}</label>
                        
                        {loadingAccounts ? (
                            <p className="text-xs t-secondary">{t('profile.loading_accounts')}</p>
                        ) : (
                            <div className="space-y-3">
                                {providers.map((provider) => {
                                    const bound = isProviderBound(provider.key);
                                    return (
                                        <div key={provider.key} className="flex items-center justify-between p-3 bg-w-secondary rounded-lg">
                                            <div className="flex items-center space-x-3">
                                                {provider.key === 'gitee' ? (
                                                    <GiteeIcon label={provider.label} onClick={() => {}} />
                                                ) : (
                                                    <Icon label={provider.label} name={provider.icon} onClick={() => {}} />
                                                )}
                                                <span className="text-sm">{provider.label}</span>
                                                {bound && (
                                                    <span className="text-xs text-green-500">{t('profile.bound')}</span>
                                                )}
                                            </div>
                                             {bound ? (
                                                 <button
                                                     onClick={() => handleUnbind(provider.key)}
                                                     disabled={isLoading}
                                                     className="text-xs px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                                                 >
                                                     {t('profile.unbind')}
                                                 </button>
                                              ) : provider.key === 'wechat' ? (
                                                  <div>
                                                      <button
                                                          onClick={() => handleBind(provider.key)}
                                                          disabled={isLoading}
                                                          className="text-xs px-3 py-1 bg-theme text-white rounded hover:bg-theme/80 disabled:opacity-50"
                                                      >
                                                          {t('profile.bind')}
                                                      </button>
                                                      <p className="text-xs text-gray-500 mt-1">{t('profile.wechat_bind_hint')}</p>
                                                  </div>
                                              ) : provider.key === 'email' ? (
                                                  <button
                                                      onClick={() => handleBind(provider.key)}
                                                      disabled={isLoading}
                                                      className="text-xs px-3 py-1 bg-theme text-white rounded hover:bg-theme/80 disabled:opacity-50"
                                                  >
                                                      {t('profile.bind')}
                                                  </button>
                                              ) : (
                                                  <div className="flex items-center space-x-2">
                                                      <button
                                                          onClick={() => handleGetBindCode(provider.key)}
                                                          disabled={isLoading}
                                                          className="text-xs px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                                                      >
                                                          {t('profile.get_code')}
                                                      </button>
                                                      <button
                                                          onClick={() => handleBind(provider.key)}
                                                          disabled={isLoading}
                                                          className="text-xs px-3 py-1 bg-theme text-white rounded hover:bg-theme/80 disabled:opacity-50"
                                                      >
                                                          {t('profile.bind')}
                                                      </button>
                                                  </div>
                                              )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Multi-factor authentication (TOTP) section */}
                    <div className="space-y-4">
                        <label className="text-sm font-medium t-secondary">{t('profile.totp.title')}</label>
                        <div className="flex items-center justify-between p-3 bg-w-secondary rounded-lg">
                            <div className="flex items-center space-x-3">
                                <Icon label="TOTP" name="ri-shield-keyhole-line" onClick={() => {}} />
                                <div className="flex flex-col">
                                    <span className="text-sm">{t('profile.totp.label')}</span>
                                    {totpEnabled ? (
                                        <span className="text-xs text-green-500">{t('profile.totp.enabled')}</span>
                                    ) : (
                                        <span className="text-xs t-secondary">{t('profile.totp.disabled')}</span>
                                    )}
                                </div>
                            </div>
                            {totpEnabled ? (
                                <button
                                    onClick={handleUnbindTotp}
                                    disabled={totpLoading}
                                    className="text-xs px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                                >
                                    {t('profile.totp.unbind')}
                                </button>
                            ) : (
                                <button
                                    onClick={handleOpenTotpModal}
                                    disabled={totpLoading}
                                    className="text-xs px-3 py-1 bg-theme text-white rounded hover:bg-theme/80 disabled:opacity-50"
                                >
                                    {t('profile.totp.bind')}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Submit button */}
                    <div className="pt-4">
                        <ButtonWithLoading
                            title={isLoading ? t('profile.saving') : t('profile.save')}
                            onClick={handleSubmit}
                            loading={isLoading}
                        />
                    </div>
                </div>
            </div>

            <Modal
                isOpen={totpModalOpen}
                onRequestClose={() => {
                    if (!totpLoading) {
                        setTotpModalOpen(false);
                    }
                }}
                contentLabel={t('profile.totp.title')}
                panelClassName="p-6"
            >
                <div className="flex flex-col space-y-4 w-full">
                    <h2 className="text-lg font-bold t-primary">{t('profile.totp.modal_title')}</h2>
                    <p className="text-sm t-secondary">{t('profile.totp.modal_hint')}</p>

                    {totpLoading && !totpSecret ? (
                        <p className="text-sm t-secondary">{t('profile.totp.loading')}</p>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <label className="text-sm font-medium t-secondary">{t('profile.totp.secret_label')}</label>
                                <code className="block w-full break-all rounded-lg bg-w-secondary px-3 py-2 text-sm font-mono t-primary">
                                    {totpSecret || '—'}
                                </code>
                                <p className="text-xs t-secondary">{t('profile.totp.secret_hint')}</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium t-secondary">{t('profile.totp.code_label')}</label>
                                <Input
                                    value={totpCode}
                                    setValue={(value) => {
                                        setTotpCode(value.replace(/\D/g, '').slice(0, 6));
                                        setTotpError('');
                                    }}
                                    placeholder={t('profile.totp.code_placeholder')}
                                    disabled={totpLoading}
                                />
                            </div>

                            {totpError && <p className="text-sm text-red-500">{totpError}</p>}

                            <div className="flex justify-end space-x-2 pt-2">
                                <button
                                    onClick={() => setTotpModalOpen(false)}
                                    disabled={totpLoading}
                                    className="text-xs px-3 py-2 rounded bg-w-secondary t-primary hover:bg-w-secondary/80 disabled:opacity-50"
                                >
                                    {t('profile.totp.cancel')}
                                </button>
                                <button
                                    onClick={handleConfirmTotp}
                                    disabled={totpLoading || totpCode.length !== 6}
                                    className="text-xs px-3 py-2 rounded bg-theme text-white hover:bg-theme/80 disabled:opacity-50"
                                >
                                    {t('profile.totp.confirm')}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </Modal>
        </div>
    );
}
