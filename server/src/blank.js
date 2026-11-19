// Entry point for a brand-new workspace (port 8789): no demo data; the owner signs up and runs the onboarding wizard.
process.env.INSTANCE ||= 'blank';
await import('./index.js');
