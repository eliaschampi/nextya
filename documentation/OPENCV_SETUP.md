# 🔍 OpenCV Setup Guide for NextYa

**Complete guide for OpenCV integration with Docker and @u4/opencv4nodejs**

---

## 📋 **Overview**

NextYa uses OpenCV 4.9.0 for advanced image processing and OMR (Optical Mark Recognition) functionality. This guide covers the complete setup and troubleshooting for OpenCV in a Docker environment.

### **Why This Setup?**

- **❌ Problem**: @u4/opencv4nodejs requires native OpenCV compilation
- **❌ Issue**: Complex build dependencies (Python, CMake, C++ compiler)
- **❌ Challenge**: Different behavior across development environments
- **✅ Solution**: Pre-compiled OpenCV Docker image `urielch/opencv-nodejs:6.2.4`

---

## 🚀 **Quick Start**

### **1. Verify OpenCV Installation**

```bash
# Test OpenCV functionality
./docker.sh opencv:test

# Expected output:
✅ OpenCV Version: 4.9.0
✅ OpenCV Build Info: General configuration for OpenCV 4.9.0
✅ Matrix creation test passed
✅ Matrix size: 100x100
✅ All OpenCV tests passed!
```

### **2. Fix OpenCV Issues (if needed)**

```bash
# Link OpenCV library
./docker.sh opencv:link

# This resolves most OpenCV linking issues
```

---

## 🏗️ **Architecture Details**

### **Docker Image Stack**

```
┌─────────────────────────────────────────┐
│           NextYa Application            │
├─────────────────────────────────────────┤
│         @u4/opencv4nodejs               │
│         (Node.js bindings)              │
├─────────────────────────────────────────┤
│         OpenCV 4.9.0                    │
│         (Pre-compiled C++ library)      │
├─────────────────────────────────────────┤
│         urielch/opencv-nodejs:6.2.4     │
│         (Ubuntu-based Docker image)     │
├─────────────────────────────────────────┤
│         Node.js 20 Runtime              │
└─────────────────────────────────────────┘
```

### **Key Components**

1. **Base Image**: `urielch/opencv-nodejs:6.2.4`
   - Ubuntu-based (not Alpine)
   - Pre-compiled OpenCV 4.9.0
   - Node.js 20 with npm/yarn
   - Python 3 for build tools

2. **OpenCV Library**:
   - Version: 4.9.0
   - Features: Core, ImgProc, ImgCodecs, HighGUI
   - Optimizations: SSE, AVX, NEON (ARM)

3. **Node.js Bindings**: `@u4/opencv4nodejs`
   - TypeScript support
   - Async/await API
   - Memory management
   - Mat object handling

---

## 🛠️ **Development Workflow**

### **Daily Development**

```bash
# Start development environment
./docker.sh up

# Verify OpenCV is working
./docker.sh opencv:test

# Start coding with OpenCV
./docker.sh npm run dev
```

### **Working with OMR**

```typescript
// Example: Process an OMR sheet
import * as cv from '@u4/opencv4nodejs';
import { omrProcessorInternal } from '$lib/omrProcessor/omrProcessor';

// Process uploaded image
const result = await omrProcessorInternal(imageBuffer, numberOfQuestions, enableDebug);

if (result.success) {
	console.log('Answers:', result.answers);
	console.log('Code:', result.code);
} else {
	console.error('Error:', result.error);
}
```

### **Image Processing Pipeline**

1. **Load Image**:

   ```typescript
   const mat = await cv.imdecodeAsync(buffer);
   ```

2. **Preprocess**:

   ```typescript
   const gray = await mat.cvtColorAsync(cv.COLOR_BGR2GRAY);
   const blurred = await gray.gaussianBlurAsync(new cv.Size(5, 5), 0);
   ```

3. **Process**:

   ```typescript
   const thresh = await blurred.adaptiveThresholdAsync(
   	255,
   	cv.ADAPTIVE_THRESH_GAUSSIAN_C,
   	cv.THRESH_BINARY,
   	11,
   	2
   );
   ```

4. **Cleanup**:
   ```typescript
   mat.release();
   gray.release();
   blurred.release();
   ```

---

## 🔧 **Configuration Details**

### **Dockerfile Configuration**

```dockerfile
# Use pre-compiled OpenCV image
FROM urielch/opencv-nodejs:6.2.4 AS base

# Install additional dependencies
RUN apt-get update && apt-get install -y shadow-utils

# Development stage
FROM base AS development
USER node
WORKDIR /app

# Smart dependency management
RUN npm remove @u4/opencv4nodejs 2>/dev/null || true && \
    npm install --force && \
    npm link @u4/opencv4nodejs
```

### **Package.json Configuration**

```json
{
	"dependencies": {
		"@u4/opencv4nodejs": "^6.2.4"
	}
}
```

### **Docker Compose Volumes**

```yaml
volumes:
  - .:/app:cached
  - /app/node_modules
  - node_modules_cache:/app/node_modules
```

---

## 🚨 **Troubleshooting**

### **Common Issues**

#### **1. Module Not Found Error**

```bash
Error: Cannot find module '@u4/opencv4nodejs'

# Solution:
./docker.sh opencv:link
```

#### **2. OpenCV Version Mismatch**

```bash
# Check current version
./docker.sh shell
node -e "console.log(require('@u4/opencv4nodejs').version)"

# Should output: 4.9.0
```

#### **3. Memory Issues**

```bash
# Increase Docker memory limits in docker-compose.yml
deploy:
  resources:
    limits:
      memory: 2G
      cpus: '1.0'
```

#### **4. Image Processing Errors**

```typescript
// Always check if Mat is valid
if (!mat || mat.empty) {
	throw new Error('Invalid image matrix');
}

// Always release Mat objects
try {
	// ... processing
} finally {
	mat.release();
}
```

### **Debug Commands**

```bash
# Test OpenCV installation
./docker.sh opencv:test

# Check OpenCV build information
./docker.sh shell
node -e "console.log(require('@u4/opencv4nodejs').getBuildInformation())"

# Monitor memory usage
./docker.sh shell
htop

# View OpenCV-related logs
./docker.sh logs app | grep -i opencv
```

---

## 📊 **Performance Optimization**

### **Memory Management**

```typescript
// Good: Proper cleanup
function processImage(buffer: Buffer) {
	let mat: cv.Mat | null = null;
	try {
		mat = cv.imdecode(buffer);
		// ... processing
		return result;
	} finally {
		if (mat) mat.release();
	}
}

// Bad: Memory leak
function processImageBad(buffer: Buffer) {
	const mat = cv.imdecode(buffer);
	// ... processing
	// mat.release() never called!
	return result;
}
```

### **Batch Processing**

```typescript
// Process multiple images efficiently
async function processBatch(images: Buffer[]) {
	const results = [];

	for (const buffer of images) {
		const result = await processImage(buffer);
		results.push(result);

		// Force garbage collection periodically
		if (results.length % 10 === 0) {
			global.gc?.();
		}
	}

	return results;
}
```

---

## 🎯 **Best Practices**

### **Development**

1. **Always test OpenCV** after container rebuild: `./docker.sh opencv:test`
2. **Use proper memory management** with Mat.release()
3. **Handle errors gracefully** with try/finally blocks
4. **Monitor memory usage** during development
5. **Use TypeScript** for better OpenCV API support

### **Production**

1. **Set memory limits** for containers
2. **Monitor OpenCV performance** with logging
3. **Implement proper error handling** for image processing
4. **Use image validation** before processing
5. **Cache processed results** when possible

---

## 📚 **Resources**

### **Documentation**

- [OpenCV Documentation](https://docs.opencv.org/4.9.0/)
- [@u4/opencv4nodejs GitHub](https://github.com/urielch/opencv4nodejs)
- [Docker Image Repository](https://hub.docker.com/r/urielch/opencv-nodejs)

### **NextYa Specific**

- `src/lib/omrProcessor/` - OMR processing implementation
- `src/lib/omrProcessor/types.ts` - TypeScript interfaces
- `src/lib/omrProcessor/constants.ts` - Configuration constants

---

**🎉 OpenCV is ready!** Use `./docker.sh opencv:test` to verify your setup anytime.
