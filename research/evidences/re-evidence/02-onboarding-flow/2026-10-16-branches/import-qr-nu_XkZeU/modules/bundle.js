const ScannerBox = ({ cameraPermission, hasError, scanning, children, isLoading, handleRequestCameraPermission })=>{
    const { formatMessage } = h();
    const Wrapper = ({ children })=><div className="w-full h-[349px] bg-tw3-background-secondary flex items-center rounded-4 justify-center"><div className="flex flex-col items-center gap-4">{children}</div></div>;
    if (cameraPermission === "denied") {
        return <Wrapper><CameraIcon/>{bs.jsx(f, {
            theme: k.LABEL_PRIMARY,
            type: u.BODY,
            children: formatMessage({
                id: "import-wallet.qr.camera-denied",
                defaultMessage: "Camera access denied. Please enable camera permissions."
            })
        })}{bs.jsx(p, {
            onClick: handleRequestCameraPermission,
            children: formatMessage({
                id: "import-wallet.qr.request-camera",
                defaultMessage: "Request Camera Access"
            })
        })}</Wrapper>;
    }
    if (scanning && cameraPermission === "granted") {
        return <div className="flex flex-col gap-6">{!hasError && !isLoading && bs.jsx(f, {
            theme: k.LABEL_PRIMARY,
            type: u.BODY,
            children: formatMessage({
                id: "import-wallet.qr.scanning-instructions",
                defaultMessage: "Hold straight and ensure good lighting"
            })
        })}{!hasError && isLoading && bs.jsx(f, {
            theme: k.LABEL_PRIMARY,
            type: u.BODY,
            children: formatMessage({
                id: "import-wallet.qr.scanning",
                defaultMessage: "Scanning... Almost there..."
            })
        })}{children}</div>;
    }
    return <Wrapper><CameraIcon/>{bs.jsx(f, {
        theme: k.LABEL_PRIMARY,
        type: u.BODY,
        children: formatMessage({
            id: "import-wallet.qr.scan-qr-code",
            defaultMessage: "Desktop Camera access required to scan QR code"
        })
    })}</Wrapper>;
};
const ImportWithQr = ({ setCurrentStep })=>{
    const { formatMessage } = h();
    const r = x();
    P({
        event: l.ONBOARDING_IMPORT_WITH_QR,
        props: {
            setupType: r
        }
    });
    const { update } = $.useContext(T);
    const { setCurrentFlow, setSelectedTrustWalletMethod } = H();
    const { trackAnalytics } = m();
    const { checkCameraPermission, requestCameraPermission } = {
        checkCameraPermission: async ()=>{
            try {
                if (!navigator.permissions) {
                    try {
                        (await navigator.mediaDevices.getUserMedia({
                            video: true
                        })).getTracks().forEach((t)=>t.stop());
                        return "granted";
                    } catch (error) {
                        if (error.name === "NotAllowedError") {
                            return "denied";
                        }
                        s.error("Error checking camera permission1:", error);
                        return "prompt";
                    }
                }
                const t = await navigator.permissions.query({
                    name: "camera"
                });
                s.debug("Permission state:", t.state);
                return t.state;
            } catch (error) {
                s.error("Error checking camera permission:", error);
                return "prompt";
            }
        },
        requestCameraPermission: async ()=>{
            try {
                (await navigator.mediaDevices.getUserMedia({
                    video: true
                })).getTracks().forEach((t)=>t.stop());
                return true;
            } catch (error) {
                s.error("Error requesting camera permission:", error);
                return false;
            }
        }
    };
    const [isLoading, setIsLoading] = $.useState(false);
    const _RefRef = $.useRef(null);
    const CRef = $.useRef(null);
    const vRef = $.useRef(null);
    const [S, setS] = $.useState(true);
    const [A, setA] = $.useState("");
    const [I, setI] = $.useState("checking");
    const MRef = $.useRef(createQrSyncReader());
    const handleRequestCameraPermission = async ()=>{
        setI("checking");
        if (await requestCameraPermission()) {
            setI("granted");
            setS(true);
        } else {
            setI("denied");
        }
    };
    $.useEffect(()=>{
        (async ()=>{
            const t = await checkCameraPermission();
            setI(t);
            if (t === "granted") {
                setS(true);
            } else if (t === "prompt") {
                await handleRequestCameraPermission();
            }
        })();
    }, []);
    $.useEffect(()=>{
        if (!S || I !== "granted") {
            return;
        }
        const r = new ni(undefined, {
            delayBetweenScanAttempts: 80,
            delayBetweenScanSuccess: 80
        });
        vRef.current = r;
        MRef.current.reset();
        let a = false;
        (async ()=>{
            try {
                await r.decodeFromVideoDevice(undefined, CRef.current, (r)=>{
                    if (!a && r) {
                        setIsLoading(true);
                        try {
                            const qrStoredKeys = MRef.current.receive(r.getText());
                            if (qrStoredKeys && !_RefRef.current) {
                                _RefRef.current = qrStoredKeys;
                                update({
                                    qrStoredKeys
                                });
                                stopStream();
                                setCurrentStep(G.INPUT_QR_PASSWORD);
                            }
                        } catch (Ms) {
                            setA(formatMessage({
                                id: "import-wallet.qr.error-parsing-frame",
                                defaultMessage: "Scan failed. Ensure you are scanning the correct QR code. Hold still and try again."
                            }));
                            setIsLoading(false);
                        }
                    }
                });
            } catch (error) {
                if (error.name === "NotReadableError") {
                    setA(formatMessage({
                        id: "import-wallet.qr.error-camera-in-use",
                        defaultMessage: "Camera is currently in use or unavailable. Please close other applications using the camera and try again."
                    }));
                }
                setS(false);
                setI("denied");
            }
        })();
        return ()=>{
            a = true;
            stopStream();
            vRef.current = null;
        };
    }, [
        S,
        I
    ]);
    const stopStream = ()=>{
        if (CRef.current && CRef.current.srcObject) {
            CRef.current.srcObject.getTracks().forEach((t)=>t.stop());
            CRef.current.srcObject = null;
        }
    };
    return <V heading={formatMessage({
        id: "import-wallet.qr.heading",
        defaultMessage: "Connect to wallet"
    })} subHeading={formatMessage({
        id: "import-wallet.qr.sub-heading-instructions",
        defaultMessage: "Hold your mobile QR code in front of the Desktop camera"
    })} animation=<O/> activeTab={3} onBackClick={()=>{
        stopStream();
        setCurrentStep(G.SCAN_QR_WITH_MOBILE);
    }}><div className="flex flex-col gap-4"><div className="mt-6">{A && <div className="mb-4">{bs.jsxs(b, {
        theme: D.ERROR,
        children: [
            A,
            bs.jsx(p, {
                onClick: ()=>{
                    MRef.current.reset();
                    setA("");
                },
                size: g.MINIMAL,
                theme: y.BRAND_TRANSPARENT,
                noPadding: true,
                className: "mt-2",
                fullWidth: false,
                children: formatMessage({
                    id: "import-wallet.qr.scan-again",
                    defaultMessage: "Please scan again here"
                })
            })
        ]
    })}</div>}<ScannerBox cameraPermission={I} hasError={!!A} scanning={S} isLoading={isLoading} handleRequestCameraPermission={handleRequestCameraPermission}><div style={{
        position: "relative",
        width: 716,
        height: 349,
        background: "#000",
        borderRadius: "16px",
        overflow: "hidden"
    }}><video ref={CRef} style={{
        width: "100%",
        height: "100%",
        transform: "scaleX(-1)",
        transformOrigin: "center"
    }}/><VideoOverlay/></div></ScannerBox><div className="mt-4 flex justify-center">{bs.jsx(p, {
        onClick: ()=>{
            stopStream();
            trackAnalytics({
                event: d.WALLET_IMPORT_MNEMONIC_INITIATED,
                props: {
                    pageViewSource: l.ONBOARDING_IMPORT_WITH_QR,
                    setupType: r
                }
            });
            setSelectedTrustWalletMethod(null);
            setCurrentFlow(U.IMPORT_WALLET);
        },
        size: g.MINIMAL,
        theme: y.BRAND_TRANSPARENT,
        noPadding: true,
        fullWidth: false,
        testid: "qr-import-manual-fallback",
        children: formatMessage({
            id: "import-wallet.qr.no-camera-fallback",
            defaultMessage: "Don't have a webcam? Import with your secret phrase instead"
        })
    })}</div></div></div></V>;
};
const InputQrPassword = ({ setCurrentStep })=>{
    const { formatMessage } = h();
    const { data: { qrStoredKeys, password, isPasswordGenerated, passkeyId, passkeyPassword }, clear } = $.useContext(T);
    const y = x();
    const { setupAuthentication } = X();
    const { trackAnalytics, setCustomPeoplePropertiesOnce } = m();
    const [C, setC] = $.useState("");
    const [E, setE] = $.useState(false);
    const [I, setI] = $.useState("");
    const [D, setD] = $.useState(false);
    const { progressDots, resetProgressDots } = Y(E);
    $.useEffect(()=>{
        if (C.length !== 6 || E) {
            if (C.length < 6) {
                setI("");
            }
        } else {
            importWallets();
        }
    }, [
        C
    ]);
    const importWallets = async ()=>{
        setE(true);
        resetProgressDots();
        try {
            if (!await A.emit(B.VERIFY_STORED_KEYS, {
                storedKeys: qrStoredKeys,
                password: C
            })) {
                setI(formatMessage({
                    id: "import-wallet.qr.password-incorrect",
                    defaultMessage: "Incorrect one-time code. Try again."
                }));
                return void setE(false);
            }
            setD(true);
            resetProgressDots();
            await setupAuthentication({
                pageViewSource: l.ONBOARDING_IMPORT_WITH_QR,
                password,
                passkeyId,
                passkeyPassword,
                isPasswordGenerated
            });
            await A.emit(B.IMPORT_STORED_KEYS, {
                storedKeys: qrStoredKeys,
                password: C
            });
            trackAnalytics({
                event: d.WALLET_CREATED,
                props: {
                    pageViewSource: l.ONBOARDING_IMPORT_WITH_QR,
                    walletType: v.MNEMONIC,
                    actionSourceType: "importwallet",
                    setupType: y
                }
            });
            setCustomPeoplePropertiesOnce({
                [c.ONBOARDING_AUTH_TYPE]: isPasswordGenerated ? z.BIOMETRICS : z.PASSWORD,
                [c.ONBOARDING_SETUP_TYPE]: W.IMPORT,
                [c.ONBOARDING_SELECTED_WALLET]: Q.TRUST_WALLET,
                [c.ONBOARDING_WALLET_TYPE]: j.QR
            });
            clear();
            setCurrentStep(G.COMPLETED);
        } catch (error) {
            if (error?.message === "MNEMONIC_ALREADY_EXISTS") {
                setI(formatMessage({
                    id: "import-wallet.seed-phrase.duplicated"
                }));
            } else if (error?.message === K.DUPLICATED) {
                setI(formatMessage({
                    id: "import-wallet.private-key.duplicated",
                    defaultMessage: "Incorrect one-time code. Try again."
                }));
            } else {
                setI(error?.message ?? error);
            }
        }
        setE(false);
    };
    return <V heading={formatMessage({
        id: "import-wallet.qr.password-heading",
        defaultMessage: "Verification required"
    })} subHeading={formatMessage({
        id: "import-wallet.qr.password-sub-heading",
        defaultMessage: "Enter one-time code from mobile"
    })} animation=<Z/> activeTab={2} onBackClick={()=>setCurrentStep(G.IMPORT_WITH_QR)}><div className="flex flex-col gap-4">{bs.jsxs(f, {
        type: u.SUBTITLE,
        theme: k.LABEL_PRIMARY,
        children: [
            formatMessage(D ? {
                id: "import-wallet.qr.body-verified",
                defaultMessage: "Verified! Syncing"
            } : E ? {
                id: "import-wallet.qr.body-loading",
                defaultMessage: "Verifying"
            } : {
                id: "import-wallet.qr.body",
                defaultMessage: 'Tap the "Request a one-time code" button on your mobile app'
            }),
            E || D ? progressDots : ""
        ]
    })}<InputCharacters length={6} value={C} onChange={setC} success={D} error={!!I}/>{bs.jsx(f, {
        type: u.BODY,
        theme: k.ERROR,
        children: I
    })}</div></V>;
};
const ScanQrWithMobile = ({ setCurrentStep })=>{
    const { formatMessage } = h();
    const { selectedTrustWalletMethod, selectedWallet, setCurrentFlow, setSelectedWallet, setSelectedTrustWalletMethod } = H();
    return <V heading={formatMessage({
        id: "import-wallet.qr.heading",
        defaultMessage: "Connect to mobile"
    })} subHeading={formatMessage({
        id: "import-wallet.qr.sub-heading-new",
        defaultMessage: "Scan this QR code with your mobile phone camera"
    })} animation=<ScanQrWithMobileAnimation/> activeTab={2} onBackClick={()=>{
        setCurrentFlow(selectedTrustWalletMethod ? U.IMPORT_WALLET : U.HOME);
    }} subHeadingAction={bs.jsxs(p, {
        theme: y.INK,
        size: g.MINIMAL,
        noPadding: true,
        onClick: ()=>{
            setSelectedWallet(Q.TRUST_WALLET);
            setSelectedTrustWalletMethod(null);
            setCurrentFlow(U.IMPORT_WALLET);
        },
        className: "flex items-center gap-2",
        fullWidth: false,
        children: [
            <M/>,
            formatMessage({
                id: "import-wallet.import-with-secret-phrase-or-private-key",
                defaultMessage: "Import with Secret Phrase or Private Key"
            })
        ]
    })}><div className="flex flex-col items-center gap-6 mt-1"><div className="flex self-start">{bs.jsx(f, {
        theme: k.LABEL_PRIMARY,
        type: u.BODY,
        children: formatMessage({
            id: "import-wallet.qr.instructions-subheading",
            defaultMessage: "After the scan, continue in your Trust Wallet mobile app"
        }, {
            icon: <span className="inline-block relative top-[5px]"><QrScanIcon/></span>
        })
    })}</div><L data="https://link.trustwallet.com/extension_sync" size={F.XLARGE} showBorder/><div className="w-[350px]">{bs.jsx(p, {
        onClick: ()=>setCurrentStep(G.IMPORT_WITH_QR),
        children: formatMessage({
            id: "import-wallet.qr-to-mobile.completed",
            defaultMessage: "I completed the scan"
        })
    })}</div></div></V>;
};
const ImportMnemonicOrPrivateKeyFlow = ()=>{
    const t = I();
    const { data: { passkeyId, password } } = $.useContext(T);
    const n = {
        [G.IMPORT_WITH_QR]: ImportWithQr,
        [G.INPUT_QR_PASSWORD]: InputQrPassword,
        [G.SCAN_QR_WITH_MOBILE]: ScanQrWithMobile,
        ...q
    };
    const [a, setA] = $.useState(t || passkeyId || password ? G.SCAN_QR_WITH_MOBILE : G.AUTHENTICATION);
    const S = n[a];
    return <S setCurrentStep={setA}/>;
};
