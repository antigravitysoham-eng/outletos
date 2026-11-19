// Entry point for the India instance: INR, GST, Indian cities, menu, staff and platforms, its own database and port (8788).
process.env.INSTANCE ||= 'india';
await import('./index.js');
