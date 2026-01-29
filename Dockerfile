FROM nginx:alpine

# Copy the build output to serve
COPY dist /usr/share/nginx/html

# Configure Nginx to listen on port 8080 (Cloud Run default)
RUN sed -i 's/listen       80;/listen       8080;/' /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
