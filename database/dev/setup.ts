import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function waitForDatabase(maxAttempts = 30): Promise<boolean> {
	console.log('⏳ Waiting for database to be ready...');
	
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			const { stdout } = await execAsync('docker exec nextya_postgres pg_isready -U postgres');
			if (stdout.includes('accepting connections')) {
				console.log('✅ Database is ready!');
				return true;
			}
		} catch (error) {
			// Database not ready yet
		}
		
		console.log(`⏳ Attempt ${attempt}/${maxAttempts} - Database not ready yet...`);
		await new Promise(resolve => setTimeout(resolve, 2000));
	}
	
	console.error('❌ Database failed to become ready within timeout');
	return false;
}

async function setupDatabase(): Promise<void> {
	console.log('🚀 Starting NextYa Database Setup...');
	console.log('=====================================');
	
	try {
		// Step 1: Start Docker containers
		console.log('🐳 Starting Docker containers...');
		await execAsync('docker-compose up -d');
		console.log('✅ Docker containers started');
		
		// Step 2: Wait for database to be ready
		const dbReady = await waitForDatabase();
		if (!dbReady) {
			throw new Error('Database failed to start');
		}
		
		// Step 3: Check if database is already initialized
		console.log('🔍 Checking database initialization status...');
		try {
			const { stdout } = await execAsync('docker exec nextya_postgres psql -U postgres -d nextya -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = \'public\';"');
			const tableCount = parseInt(stdout.split('\n')[2].trim());
			
			if (tableCount > 0) {
				console.log(`✅ Database already initialized with ${tableCount} tables`);
				console.log('🔄 Generating TypeScript types...');
				await execAsync('npm run db:generate');
				console.log('✅ Setup completed - database was already initialized');
				return;
			}
		} catch (error) {
			// Database might not be initialized yet, continue with setup
		}
		
		// Step 4: Initialize database with SQL files (if not already done by Docker)
		console.log('🔄 Initializing database with SQL files...');
		await execAsync('npm run sql:migrate');
		console.log('✅ Database initialized with SQL files');
		
		// Step 5: Generate TypeScript types
		console.log('🔄 Generating TypeScript types...');
		await execAsync('npm run db:generate');
		console.log('✅ TypeScript types generated');
		
		console.log('');
		console.log('🎉 Database setup completed successfully!');
		console.log('=====================================');
		console.log('');
		console.log('📋 Next steps:');
		console.log('  • Run "npm run dev" to start the development server');
		console.log('  • Use "npm run db:migrate" for future schema changes');
		console.log('  • Use "npm run sql:list" to see your SQL files');
		console.log('');
		
	} catch (error) {
		console.error('❌ Database setup failed:', error);
		console.log('');
		console.log('🔧 Troubleshooting:');
		console.log('  • Make sure Docker is running');
		console.log('  • Try "docker-compose down -v && docker-compose up -d"');
		console.log('  • Check logs with "docker-compose logs postgres"');
		throw error;
	}
}

async function resetAndSetup(): Promise<void> {
	console.log('🔄 Resetting and setting up database...');
	
	try {
		// Reset Docker containers
		console.log('🐳 Resetting Docker containers...');
		await execAsync('docker-compose down -v');
		console.log('✅ Containers stopped and volumes removed');
		
		// Start fresh setup
		await setupDatabase();
		
	} catch (error) {
		console.error('❌ Reset and setup failed:', error);
		throw error;
	}
}

async function showStatus(): Promise<void> {
	console.log('📊 NextYa Database Status');
	console.log('========================');
	
	try {
		// Check Docker containers
		console.log('🐳 Docker Containers:');
		const { stdout: containers } = await execAsync('docker-compose ps');
		console.log(containers);
		
		// Check database connection
		console.log('🔍 Database Connection:');
		try {
			await execAsync('docker exec nextya_postgres pg_isready -U postgres');
			console.log('✅ Database is accessible');
			
			// Check table count
			const { stdout } = await execAsync('docker exec nextya_postgres psql -U postgres -d nextya -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = \'public\';"');
			const tableCount = parseInt(stdout.split('\n')[2].trim());
			console.log(`📊 Tables in database: ${tableCount}`);
			
		} catch (error) {
			console.log('❌ Database is not accessible');
		}
		
		// Show SQL files
		console.log('\n📁 SQL Files:');
		await execAsync('npm run sql:list');
		
	} catch (error) {
		console.error('❌ Failed to get status:', error);
	}
}

// Parse command line arguments
const command = process.argv[2];

async function main() {
	switch (command) {
		case 'setup':
			await setupDatabase();
			break;
		case 'reset':
			await resetAndSetup();
			break;
		case 'status':
			await showStatus();
			break;
		default:
			console.log('NextYa Database Setup Utility');
			console.log('=============================');
			console.log('Usage: npm run setup:[command]');
			console.log('');
			console.log('Commands:');
			console.log('  setup:init     Initialize database (first time setup)');
			console.log('  setup:reset    Reset and reinitialize database');
			console.log('  setup:status   Show database and container status');
			console.log('');
			console.log('Quick start:');
			console.log('  npm run setup:init    # First time setup');
			console.log('  npm run dev           # Start development server');
			break;
	}
}

main().catch(console.error);
