FROM python:3.13-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
# Strip Windows line endings in case the repo was checked out with CRLF.
RUN sed -i 's/\r$//' start.sh

EXPOSE 8000
CMD ["sh", "start.sh"]
