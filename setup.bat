@echo off
echo Setting up project...
python -m venv venv
call venv\Scripts\activate
pip install -r requirements.txt
echo.
echo Done! To run the app:
echo   venv\Scripts\activate ^&^& python app.py
pause
