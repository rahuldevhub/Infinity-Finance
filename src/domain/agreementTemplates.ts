export const SAMPLE_AGREEMENT_TEMPLATE = {
  key: 'standard_service_agreement_v1',
  name: 'Standard Service Agreement (Sample)',
  title: 'Service Agreement — {{project_name}}',
  body: `This sample Service Agreement is made on {{date}} between {{company_name}} (the “Service Provider”) and {{client_name}} (the “Client”).

Client email: {{client_email}}
Client phone: {{client_phone}}
Client address: {{client_address}}

Project: {{project_name}}
Services: {{service_details}}
Proposed commercial value: {{proposed_price}}
Confirmed contract value: {{contract_value}}

1. Scope. The Service Provider will perform the services described above for the Project.
2. Commercial terms. Final obligations, milestones, taxes, and payment terms must be confirmed by the parties in the executed agreement and applicable financial documents.
3. Client responsibilities. The Client will provide timely information, approvals, and materials needed to perform the services.
4. Confidentiality. Each party will protect confidential information received from the other party.
5. Intellectual property. Ownership and licensing terms will be those stated in the executed agreement.
6. Termination. Either party may terminate according to the notice and settlement terms in the executed agreement.

This is a sample template for review. It is not executed merely by generating or downloading this preview.`,
} as const;
