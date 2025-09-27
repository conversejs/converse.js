FROM nginx:stable-alpine

# Install bash for terminal access
RUN apk add --no-cache bash

# Copy fullscreen.html as template for custom.html, if it doesn't exist
COPY fullscreen.html /usr/share/nginx/html/custom.html

# Copy all necessary files for the app to work
COPY dist/ /usr/share/nginx/html/dist/
COPY manifest.json /usr/share/nginx/html/


# Configure nginx for cache and compression
RUN cat <<EOF > /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index custom.html;

    location / {
        try_files \$uri \$uri/ /custom.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)\$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
EOF

EXPOSE 80

# Create volume for customizable file
VOLUME ["/usr/share/nginx/html"]

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
