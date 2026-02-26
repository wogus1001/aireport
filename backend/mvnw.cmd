@ECHO OFF
SETLOCAL

SET "BASE_DIR=%~dp0"
SET "WRAPPER_JAR=%BASE_DIR%\.mvn\wrapper\maven-wrapper.jar"
SET "WRAPPER_PROPERTIES=%BASE_DIR%\.mvn\wrapper\maven-wrapper.properties"

IF "%JAVA_HOME%"=="" (
  SET "JAVACMD=java.exe"
) ELSE (
  SET "JAVACMD=%JAVA_HOME%\bin\java.exe"
)

IF NOT EXIST "%WRAPPER_JAR%" (
  IF NOT EXIST "%WRAPPER_PROPERTIES%" (
    ECHO Error: "%WRAPPER_PROPERTIES%" does not exist.
    EXIT /B 1
  )

  SET "WRAPPER_URL="
  FOR /F "usebackq tokens=1,* delims==" %%A IN ("%WRAPPER_PROPERTIES%") DO (
    IF /I "%%A"=="wrapperUrl" SET "WRAPPER_URL=%%B"
  )
  IF "%WRAPPER_URL%"=="" SET "WRAPPER_URL=https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.2.0/maven-wrapper-3.2.0.jar"

  powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri 'https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.2.0/maven-wrapper-3.2.0.jar' -OutFile '%WRAPPER_JAR%'" >NUL 2>NUL
  IF ERRORLEVEL 1 (
    ECHO Error: Failed to download Maven wrapper jar.
    EXIT /B 1
  )
)

"%JAVACMD%" -Dmaven.multiModuleProjectDirectory="%BASE_DIR%" -classpath "%WRAPPER_JAR%" org.apache.maven.wrapper.MavenWrapperMain %*
SET "MVNW_EXIT_CODE=%ERRORLEVEL%"
ENDLOCAL & EXIT /B %MVNW_EXIT_CODE%
