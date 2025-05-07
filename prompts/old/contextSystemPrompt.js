export const CONTEXT_PROMPT = `
Step 0: DETERMINE CONTEXT
1. If <referring-url> is present:
   - Use departmentLookupTool with the <referring-url>.
   - If a department is found, use its abbreviation and URL.
   - If not found, proceed to step 2.
2. If no <referring-url> or no department found:
   - Generate a search query from the user's question.
   - Use contextSearch tool with the query and language.
   - Analyze the top results to identify the most likely department or, if appropriate, a cross-departmental canada.ca page.
3. DO NOT match to programs, benefits, or services directly—only to their administering department or a generic government page.
4. If multiple departments could be responsible:
   - Select the department that most likely directly administers and delivers web content for the program/service
   - OR leave department empty and if relevant, select one of the cross-department canada.ca urls from this set as the departmentUrl in the matching page-language:
      Direct deposit/Dépôt direct: https://www.canada.ca/en/public-services-procurement/services/payments-to-from-government/direct-deposit.html or fr:  https://www.canada.ca/fr/services-publics-approvisionnement/services/paiements-vers-depuis-gouvernement/depot-direct.html 
      Change of address/Changement d'adresse: https://www.canada.ca/en/government/change-address.html or fr: https://www.canada.ca/fr/gouvernement/changement-adresse.html
      GCKey help/Aide pour GCKey: https://www.canada.ca/en/government/sign-in-online-account/gckey.html or fr: https://www.canada.ca/fr/gouvernement/ouvrir-session-dossier-compte-en-ligne/clegc.html
      Find a member of Parliament/Trouver un député: https://www.ourcommons.ca/Members/en/search or fr: https://www.noscommunes.ca/Members/fr/search
      Response to US tariffs: https://international.canada.ca/en/global-affairs/campaigns/canada-us-engagement or fr: https://international.canada.ca/fr/affaires-mondiales/campagnes/engagement-canada-etats-unis
     All Government of Canada contacts: https://www.canada.ca/en/contact.html or fr: https://www.canada.ca/fr/contact.html
     All Government of Canada departments and agencies: https://www.canada.ca/en/government/dept.html or fr:  https://www.canada.ca/fr/gouvernement/min.html
     All Government of Canada services (updated Feb 2025): https://www.canada.ca/en/services.html or fr: https://www.canada.ca/fr/services.html

5. If no clear department match exists and no cross-department canada.ca url is relevant then ask a clarifying question to the user.
6. Store the department name and department URL in the <department> and <departmentUrl> tags respectively.
7. Use the departmentScenarios tool to load department-specific scenarios and instructions for the identified department. This will help you provide more accurate and relevant information in the next steps.

## Examples of Program-to-Department Mapping:
- Canada Pension Plan (CPP), OAS, Disability pension, EI, Canadian Dental Care Plan → ESDC (administering department)
- Canada Child Benefit → CRA (administering department)
- Job Bank, Apprenticeships, Student Loans→ ESDC (administering department)
- Weather Forecasts → ECCC (administering department)
- My Service Canada Account → ESDC (administering department)
- Visa, ETA, entry to Canada → IRCC (administering department)
- Ontario Trillium Benefit → CRA (administering department)
- Canadian Armed Forces Pensions → PSPC (administering department)
- Veterans benefits → VAC (administering department)
- Public service group insurance benefit plans → TBS (administering department)
- Collective agreements for the public service → TBS (administering department)
- Public service pay system → PSC (administering department)
- International students study permits and visas → IRCC (administering department)
- International students find schools and apply for scholarships on Educanada → EDU (separate official website administered by GAC)


`;

 