import { app } from '@azure/functions';
import { DefaultAzureCredential } from '@azure/identity';
import {
  BlobServiceClient,
  BlobSASPermissions,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from '@azure/storage-blob';

const containerName = 'price-lists';
const filePattern = /^(?:AX|NL)-(January|February|March|April|May|June|July|August|September|October|November|December)-(\d{4})-Newcommerce-Cloud-Reseller-Pricelist\.zip$/i;
const connectionString = process.env.PRICE_LISTS_STORAGE_CONNECTION_STRING;
const storageAccountName = process.env.PRICE_LISTS_STORAGE_ACCOUNT_NAME;
const managedIdentityEnabled = process.env.PRICE_LISTS_AUTH_MODE === 'managed-identity' && Boolean(storageAccountName);

const getStorageContext = () => {
  if (managedIdentityEnabled) {
    const accountUrl = `https://${storageAccountName}.blob.core.windows.net`;
    const credential = new DefaultAzureCredential();
    return {
      accountName: storageAccountName,
      accountUrl,
      credential,
      container: new BlobServiceClient(accountUrl, credential).getContainerClient(containerName),
    };
  }
  if (!connectionString) throw new Error('PRICE_LISTS_STORAGE_ACCOUNT_NAME or PRICE_LISTS_STORAGE_CONNECTION_STRING must be configured.');

  const accountName = connectionString.match(/(?:^|;)AccountName=([^;]+)/i)?.[1];
  const accountKey = connectionString.match(/(?:^|;)AccountKey=([^;]+)/i)?.[1];
  if (!accountName || !accountKey) throw new Error('The storage connection string is invalid.');

  return {
    accountName,
    accountKey,
    accountUrl: `https://${accountName}.blob.core.windows.net`,
    container: BlobServiceClient.fromConnectionString(connectionString).getContainerClient(containerName),
  };
};

const getManifest = async () => {
  const { container } = getStorageContext();
  const response = await container.getBlobClient('manifest.json').download();
  const chunks = [];
  for await (const chunk of response.readableStreamBody ?? []) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

app.http('listPriceLists', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'price-lists',
  handler: async (_request, context) => {
    try {
      return { jsonBody: await getManifest() };
    } catch (error) {
      context.error('Failed to read price list manifest.', error);
      return { status: 503, jsonBody: { error: 'Price list catalog is temporarily unavailable.' } };
    }
  },
});

app.http('getPriceListUrl', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'price-lists/{fileName}',
  handler: async (request, context) => {
    const fileName = request.params.fileName;
    if (!fileName || !filePattern.test(fileName)) {
      return { status: 400, jsonBody: { error: 'Invalid price list filename.' } };
    }

    try {
      const { accountName, accountKey, accountUrl, credential, container } = getStorageContext();
      const blobClient = container.getBlobClient(fileName);
      if (!(await blobClient.exists())) return { status: 404, jsonBody: { error: 'Price list not found.' } };

      if (request.query.get('download') === '1') {
        const archive = await blobClient.downloadToBuffer();
        return {
          body: archive,
          headers: {
            'Content-Type': 'application/zip',
            'Content-Disposition': 'inline',
            'Cache-Control': 'private, max-age=300',
          },
        };
      }

      const sasOptions = {
        containerName,
        blobName: fileName,
        permissions: BlobSASPermissions.parse('r'),
        startsOn: new Date(Date.now() - 60_000),
        expiresOn: new Date(Date.now() + 5 * 60_000),
        protocol: 'https',
      };
      const sas = managedIdentityEnabled
        ? generateBlobSASQueryParameters(sasOptions, await new BlobServiceClient(accountUrl, credential).getUserDelegationKey(sasOptions.startsOn, sasOptions.expiresOn), accountName).toString()
        : generateBlobSASQueryParameters(sasOptions, new StorageSharedKeyCredential(accountName, accountKey)).toString();

      return { jsonBody: { url: `${blobClient.url}?${sas}` } };
    } catch (error) {
      context.error('Failed to create price list URL.', error);
      return { status: 503, jsonBody: { error: 'Price list is temporarily unavailable.' } };
    }
  },
});
