import RNSecureKeyStore, { ACCESSIBLE } from 'react-native-secure-key-store';
import { action, observable } from 'mobx';
import RNFetchBlob from 'rn-fetch-blob';
import RESTUtils from '../utils/RESTUtils';

interface Node {
    host?: string;
    port?: string;
    url?: string;
    macaroonHex?: string;
    accessKey?: string;
    implementation?: string;
    sslVerification?: boolean;
}

interface Settings {
    nodes?: Array<Node>;
    onChainAddress?: string;
    theme?: string;
    lurkerMode?: boolean;
    selectedNode?: number;
    passphrase?: string;
    fiat?: string;
}

export default class SettingsStore {
    @observable settings: Settings = {};
    @observable loading: boolean = false;
    @observable btcPayError: string | null;
    @observable host: string;
    @observable port: string;
    @observable url: string;
    @observable macaroonHex: string;
    @observable accessKey: string;
    @observable implementation: string;
    @observable sslVerification: boolean | undefined;
    @observable chainAddress: string | undefined;
    // LNDHub
    @observable public createAccountError: string;

    @action
    public fetchBTCPayConfig = (data: string) => {
        const configRoute = data.split('config=')[1];
        this.btcPayError = null;

        return RNFetchBlob.fetch('get', configRoute)
            .then((response: any) => {
                const status = response.info().status;
                if (status == 200) {
                    const data = response.json();
                    const configuration = data.configurations[0];
                    const {
                        adminMacaroon,
                        macaroon,
                        type,
                        uri
                    } = configuration;

                    if (type !== 'lnd-rest' && type !== 'clightning-rest') {
                        this.btcPayError =
                            'Sorry, we currently only support BTCPay instances using lnd or c-lightning';
                    } else {
                        const config = {
                            host: uri.split('https://')[1],
                            macaroonHex: adminMacaroon || macaroon,
                            implementation:
                                type === 'clightning-rest'
                                    ? 'c-lightning-REST'
                                    : 'lnd'
                        };

                        return config;
                    }
                } else {
                    this.btcPayError = 'Error getting BTCPay configuration';
                }
            })
            .catch((err: any) => {
                // handle error
                this.btcPayError = `Error getting BTCPay configuration: ${err.toString()}`;
            });
    };

    hasCredentials() {
        return this.macaroonHex || this.accessKey ? true : false;
    }

    @action
    public async getSettings() {
        this.loading = true;

        try {
            // Retrieve the credentials
            const credentials: any = await RNSecureKeyStore.get(
                'zeus-settings'
            );
            this.loading = false;
            if (credentials) {
                this.settings = JSON.parse(credentials);
                const node: any =
                    this.settings.nodes &&
                    this.settings.nodes[this.settings.selectedNode || 0];
                if (node) {
                    this.host = node.host;
                    this.port = node.port;
                    this.url = node.url;
                    this.macaroonHex = node.macaroonHex;
                    this.accessKey = node.accessKey;
                    this.implementation = node.implementation || 'lnd';
                    this.sslVerification = node.sslVerification || false;
                }
                this.chainAddress = this.settings.onChainAddress;
                return this.settings;
            } else {
                console.log('No credentials stored');
            }
        } catch (error) {
            this.loading = false;
            console.log("Keychain couldn't be accessed!", error);
        }
    }

    @action
    public async setSettings(settings: string) {
        this.loading = true;

        // Store the credentials
        await RNSecureKeyStore.set('zeus-settings', settings, {
            accessible: ACCESSIBLE.WHEN_UNLOCKED
        }).then(() => {
            this.loading = false;
            return settings;
        });
    }

    @action
    public getNewAddress = () => {
        return RESTUtils.getNewAddress().then((data: any) => {
            // handle success
            this.chainAddress = data.address;
            const newSettings = {
                ...this.settings,
                onChainAddress: data.address
            };

            this.setSettings(JSON.stringify(newSettings));
        });
    };

    // LNDHub
    @action
    public createAccount = (host: string, sslVerification: boolean) => {
        this.createAccountError = '';
        this.loading = true;
        RESTUtils.createAccount(host, sslVerification)
            .then((data: any) => {
                this.username = data.login;
                this.password = data.password;
                this.error = false;
                return data;
            })
            .catch((error: any) => {
                // handle error
                this.createAccountError = error.toString();
                console.log('err');
                console.log(error);
                this.loading = false;
            });
    };
}
