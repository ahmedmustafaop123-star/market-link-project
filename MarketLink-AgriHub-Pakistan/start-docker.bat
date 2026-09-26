@echo off
title MarketLink Agri-Hub Pakistan (Docker)
echo Starting MarketLink with Docker (PostgreSQL included)...
echo First run downloads images and builds - may take 3-5 minutes.
echo When you see "Ready", open http://localhost:3000
echo.
docker compose up --build
pause
