# Azure deployment context

## Current deployment path

CSP Insights is deployed through GitHub Actions to Azure Static Web Apps. The workflow uses the repository secret:

`AZURE_STATIC_WEB_APPS_API_TOKEN_BLACK_GLACIER_094913A03`

The workflow is intentionally the source of truth for the deployment target; the token is never committed to the repository.

## Validation checklist

Before changing Azure resources, verify the subscription and Static Web App explicitly:

```powershell
az account show
az resource list --query "[?type=='Microsoft.Web/staticSites'].{name:name,group:resourceGroup,location:location}" -o table
```

At the time of the last validation, the active Azure CLI context was the `VSE6-F - 5 - FietsWeerPro` subscription and contained no CSP Insights Static Web App. Do not deploy or modify the FietsWeerPro resources as a substitute. Use the Azure portal or a subscription/resource-group context that contains the CSP Insights Static Web App before performing resource operations.

## Operational notes

- GitHub Actions performs build, lint, unit tests, security audit, Playwright smoke tests, and deployment.
- A successful local build does not prove that the Static Web Apps token points to the intended resource.
- Azure MCP is not currently connected to this workspace; Azure CLI checks are read-only unless an explicit resource command is run.
