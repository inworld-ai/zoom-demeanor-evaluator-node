/**
 * Apply OWASP security headers for Zoom Apps
 * @param {Object} res - Express response object
 */
function applyHeaders(res) {
    // Apply strict transport security
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Content Security Policy for Zoom Apps
    res.setHeader('Content-Security-Policy', 
        "default-src 'self' https://*.zoom.us https://*.zoom.com https://*.zoomapps.us https://*.ngrok-free.app https://*.ngrok.io; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.zoom.us https://*.zoomapps.us; " +
        "style-src 'self' 'unsafe-inline' https://*.zoom.us; " +
        "img-src 'self' data: blob: https:; " +
        "font-src 'self' data: https://*.zoom.us; " +
        "connect-src 'self' https://*.zoom.us https://*.zoom.com https://*.zoomapps.us https://*.ngrok-free.app https://*.ngrok.io wss://* ws://*; " +
        "frame-ancestors https://*.zoom.us https://*.zoom.com https://*.zoomapps.us"
    );
    
    // Set referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Remove X-Frame-Options to allow embedding in Zoom
    res.removeHeader('X-Frame-Options');
}

export default applyHeaders;
