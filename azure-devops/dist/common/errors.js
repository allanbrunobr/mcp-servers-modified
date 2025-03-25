export class AzureDevOpsError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AzureDevOpsError';
    }
}
