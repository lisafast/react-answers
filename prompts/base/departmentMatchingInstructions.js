// Provides detailed instructions for Step 2: Department Identification.
// Includes the matching algorithm and examples.
export const DEPARTMENT_MATCHING_INSTRUCTIONS = `
### Step 2 Details: IDENTIFY DEPARTMENT

Your goal in this step is to identify the most relevant Government of Canada department (and its primary URL) for the user's question context.

**Process:**

1.  **Initial Check with \`<referring-url>\`:**
    *   Examine the \`<referring-url>\` provided in the context.
    *   **If** the URL seems relevant to the \`<english-question>\` AND is not empty or 'Not provided':
        *   Call the \`departmentLookup\` tool with this \`<referring-url>\`.
        *   **If** it returns department details (JSON object): Parse it, extract \`abbr\` for \`<department>\` and \`url\` for \`<departmentUrl>\`. **Proceed to Step 4 (Update Checks).**
        *   **If** it returns "Department not found", proceed to Step 2 (Search and Lookup).
    *   **Else** (if \`<referring-url>\` is missing, 'Not provided', or seems irrelevant to the question), proceed directly to Step 2 (Search and Lookup).

2.  **Search and Lookup (if needed):**
    *   This step is used if the initial check above failed or was skipped.
    *   **Rewrite Query:** Formulate an effective search query based on the \`<english-question>\` aimed at identifying the responsible government department or program (e.g., "which canadian government department handles maternity benefits").
    *   **Use \`contextSearch\` Tool:** Execute the search query using the \`contextSearch\` tool.
    *   **Analyze Search Results for URLs:** Examine the \`<searchResults>\`. Identify the most promising URL(s) from the results that likely belong to a relevant Government of Canada department or program page (e.g., contains 'cra.gc.ca', 'esdc.gc.ca', 'canada.ca/[lang]/[dept-name]').
    *   **Use \`departmentLookup\` on Search Result URL(s):**
        *   Call the \`departmentLookup\` tool on the single most promising URL identified from the search results.
        *   **If** it returns department details (JSON object): Parse it, extract \`abbr\` for \`<department>\` and \`url\` for \`<departmentUrl>\`. **Proceed to Step 4 (Update Checks).**
        *   **If** it returns "Department not found" (or if no promising URL was found in search results), proceed to Step 3 (Matching Algorithm Fallback).

3.  **Matching Algorithm Fallback (if needed):**
    *   This fallback is used only if both the initial \`<referring-url>\` lookup AND the lookup on search result URLs failed to return department details.
    *   Analyze the \`<searchResults>\`, \`<english-question>\`, and original \`<referring-url>\` context.
    *   Apply the **Matching Algorithm** below to *infer* the most likely \`<department>\` (abbreviation) and \`<departmentUrl>\`. If successful, store these values. If no clear inference can be made, leave the values empty. **Proceed to Step 4 (Update Checks).**

4.  **Update Preliminary Checks:**
    *   After completing the relevant path above (Step 1, 2, or 3), **update** the \`<department>\` and \`<departmentUrl>\` tags within the \`<preliminary-checks>\` block you generated in Step 1 with the values you identified (or leave them empty if no match was found).
    *   **Then, proceed to the main Workflow Step 3 (Load Department Scenarios).**

**Matching Algorithm (Apply ONLY in Step 3 Fallback):**

1.  **Extract Key Topics:** Identify the main subjects, programs, services, or entities mentioned in the user's question and the \`<referring-url>\` context.
2.  **Prioritize Context:** Give more weight to the user's question and the \`<referring-url>\` context than the raw \`<searchResults>\`, as search results can sometimes be misleading. The \`<referring-url>\` often indicates the user's context, but be aware of potential misunderstandings (e.g., user on MSCA page asking about CRA tax forms).
3.  **Match to Department, Not Program:** Identify the *administering department* responsible for the topic, program, or service. Do NOT simply use the program name. Use the **Examples of Program-to-Department Mapping** below for guidance. Infer the standard abbreviation (e.g., ESDC, CRA, IRCC) and the primary department URL (usually like \`https://www.canada.ca/[lang]/[department-name].html\`).
4.  **Handle Ambiguity:**
    *   If multiple departments seem plausible, select the one most likely to *directly administer* and provide web content for the specific program/service mentioned.
    *   If the topic is cross-departmental and generic (like direct deposit, address change, GCKey), consider using one of the specific cross-departmental URLs listed below as the \`<departmentUrl>\` and leave \`<department>\` empty. Use the URL matching the \`<page-language>\`.
        *   Direct deposit/Dépôt direct: \`https://www.canada.ca/en/public-services-procurement/services/payments-to-from-government/direct-deposit.html\` or fr: \`https://www.canada.ca/fr/services-publics-approvisionnement/services/paiements-vers-depuis-gouvernement/depot-direct.html\`
        *   Change of address/Changement d'adresse: \`https://www.canada.ca/en/government/change-address.html\` or fr: \`https://www.canada.ca/fr/gouvernement/changement-adresse.html\`
        *   GCKey help/Aide pour GCKey: \`https://www.canada.ca/en/government/sign-in-online-account/gckey.html\` or fr: \`https://www.canada.ca/fr/gouvernement/ouvrir-session-dossier-compte-en-ligne/clegc.html\`
        *   Find a member of Parliament/Trouver un député: \`https://www.ourcommons.ca/Members/en/search\` or fr: \`https://www.noscommunes.ca/Members/fr/search\`
        *   Response to US tariffs: \`https://international.canada.ca/en/global-affairs/campaigns/canada-us-engagement\` or fr: \`https://international.canada.ca/fr/affaires-mondiales/campagnes/engagement-canada-etats-unis\`
        *   All Government of Canada contacts: \`https://www.canada.ca/en/contact.html\` or fr: \`https://www.canada.ca/fr/contact.html\`
        *   All Government of Canada departments and agencies: \`https://www.canada.ca/en/government/dept.html\` or fr: \`https://www.canada.ca/fr/gouvernement/min.html\`
        *   All Government of Canada services (updated Feb 2025): \`https://www.canada.ca/en/services.html\` or fr: \`https://www.canada.ca/fr/services.html\`
5.  **No Match:** If no clear department match exists and no cross-department URL is relevant, leave \`<department>\` and \`<departmentUrl>\` empty in the preliminary checks.

**Examples of Program-to-Department Mapping:**

*   Canada Pension Plan (CPP), Old Age Security (OAS), Disability pension, Employment Insurance (EI), Canadian Dental Care Plan → **ESDC** (Employment and Social Development Canada)
*   Canada Child Benefit (CCB), GST/HST Credit, Income Tax → **CRA** (Canada Revenue Agency)
*   Job Bank, Apprenticeships, Canada Student Loans → **ESDC**
*   Weather Forecasts → **ECCC** (Environment and Climate Change Canada)
*   My Service Canada Account (MSCA) → **ESDC**
*   Passports, Visa, ETA, Immigration, Citizenship → **IRCC** (Immigration, Refugees and Citizenship Canada)
*   Ontario Trillium Benefit → **CRA** (Administers for Ontario)
*   Canadian Armed Forces Pensions → **PSPC** (Public Services and Procurement Canada)
*   Veterans benefits → **VAC** (Veterans Affairs Canada)
*   Public service group insurance benefit plans → **TBS** (Treasury Board of Canada Secretariat)
*   Collective agreements for the public service → **TBS**
*   Public service pay system (Phoenix) → **PSPC** (Administers Pay Centre)
*   International students study permits and visas → **IRCC**
*   International students find schools/scholarships (EduCanada) → **GAC** (Global Affairs Canada - administers EDU website)
`;
