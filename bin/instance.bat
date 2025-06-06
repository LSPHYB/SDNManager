@echo off
rem
rem
rem    Licensed to the Apache Software Foundation (ASF) under one or more
rem    contributor license agreements.  See the NOTICE file distributed with
rem    this work for additional information regarding copyright ownership.
rem    The ASF licenses this file to You under the Apache License, Version 2.0
rem    (the "License"); you may not use this file except in compliance with
rem    the License.  You may obtain a copy of the License at
rem
rem       http://www.apache.org/licenses/LICENSE-2.0
rem
rem    Unless required by applicable law or agreed to in writing, software
rem    distributed under the License is distributed on an "AS IS" BASIS,
rem    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
rem    See the License for the specific language governing permissions and
rem    limitations under the License.
rem

if not "%ECHO%" == "" echo %ECHO%

setlocal
set DIRNAME=%~dp0%
set PROGNAME=%~nx0%
set ARGS=%*

rem Sourcing environment settings for karaf similar to tomcats setenv
SET KARAF_SCRIPT="instance.bat"
if exist "%DIRNAME%setenv.bat" (
  call "%DIRNAME%setenv.bat"
)

rem Check console window title. Set to Karaf by default
if not "%KARAF_TITLE%" == "" (
    title %KARAF_TITLE%
) else (
    title Karaf
)

rem Check/Set up some easily accessible MIN/MAX params for JVM mem usage
if "%JAVA_MIN_MEM%" == "" (
    set JAVA_MIN_MEM=128M
)
if "%JAVA_MAX_MEM%" == "" (
    set JAVA_MAX_MEM=512M
)

goto BEGIN

:warn
    echo %PROGNAME%: %*
goto :EOF

:BEGIN

rem # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # #

if not "%KARAF_HOME%" == "" (
    call :warn Ignoring predefined value for KARAF_HOME
)
set KARAF_HOME=%DIRNAME%..
if not exist "%KARAF_HOME%" (
    call :warn KARAF_HOME is not valid: "%KARAF_HOME%"
    goto END
)

if not "%KARAF_BASE%" == "" (
    if not exist "%KARAF_BASE%" (
       call :warn KARAF_BASE is not valid: "%KARAF_BASE%"
       goto END
    )
)
if "%KARAF_BASE%" == "" (
  set "KARAF_BASE=%KARAF_HOME%"
)

if not "%KARAF_DATA%" == "" (
    if not exist "%KARAF_DATA%" (
        call :warn KARAF_DATA is not valid: "%KARAF_DATA%"
        goto END
    )
)
if "%KARAF_DATA%" == "" (
    set "KARAF_DATA=%KARAF_BASE%\data"
)

if not "%KARAF_ETC%" == "" (
    if not exist "%KARAF_ETC%" (
        call :warn KARAF_ETC is not valid: "%KARAF_ETC%"
        goto END
    )
)
if "%KARAF_ETC%" == "" (
    set "KARAF_ETC=%KARAF_BASE%\etc"
)

set DEFAULT_JAVA_OPTS=
if not "%ODL_JAVA_SECURITY_PROPERTIES%" == "" (
    set DEFAULT_JAVA_OPTS=-Djava.security.properties="%ODL_JAVA_SECURITY_PROPERTIES%" %DEFAULT_JAVA_OPTS%
) else (
    set DEFAULT_JAVA_OPTS=-Djava.security.properties="%KARAF_ETC%\odl.java.security" %DEFAULT_JAVA_OPTS%
)

set DEFAULT_JAVA_DEBUG_OPTS=-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=5005

rem Support for loading native libraries
set PATH=%PATH%;%KARAF_BASE%\lib;%KARAF_HOME%\lib

rem Setup the Java Virtual Machine
if not "%JAVA%" == "" goto :Check_JAVA_END
    set JAVA=java
    if "%JAVA_HOME%" == "" call :warn JAVA_HOME not set; results may vary
    if not "%JAVA_HOME%" == "" set JAVA=%JAVA_HOME%\bin\java
    if not exist "%JAVA_HOME%" (
        call :warn JAVA_HOME is not valid: "%JAVA_HOME%"
        goto END
    )
:Check_JAVA_END

if "%JAVA_OPTS%" == "" set JAVA_OPTS=%DEFAULT_JAVA_OPTS%

if "%EXTRA_JAVA_OPTS%" == "" goto :KARAF_EXTRA_JAVA_OPTS_END
    set JAVA_OPTS="%JAVA_OPTS% %EXTRA_JAVA_OPTS%"
:KARAF_EXTRA_JAVA_OPTS_END

if "%KARAF_DEBUG%" == "" goto :KARAF_DEBUG_END
    rem Use the defaults if JAVA_DEBUG_OPTS was not set
    if "%JAVA_DEBUG_OPTS%" == "" set JAVA_DEBUG_OPTS=%DEFAULT_JAVA_DEBUG_OPTS%

    set JAVA_OPTS="%JAVA_DEBUG_OPTS% %JAVA_OPTS%"
    call :warn Enabling Java debug options: %JAVA_DEBUG_OPTS%
:KARAF_DEBUG_END

rem Setup the classpath
pushd "%KARAF_HOME%\lib"
for %%G in (karaf*.jar) do call:APPEND_TO_CLASSPATH %%G
popd
goto CLASSPATH_END

: APPEND_TO_CLASSPATH
set filename=%~1
set suffix=%filename:~-4%
if %suffix% equ .jar set CLASSPATH=%CLASSPATH%;%KARAF_HOME%\lib\%filename%
goto :EOF

:CLASSPATH_END

set CLASSPATH=%KARAF_HOME%\system\org\apache\karaf\instance\org.apache.karaf.instance.command${karaf.version}\org.apache.karaf.instance.command-3.0.8.jar;%KARAF_HOME%\system\org\apache\karaf\instance\org.apache.karaf.instance.core${karaf.version}\org.apache.karaf.instance.core-3.0.8.jar;%KARAF_HOME%\system\org\apache\karaf\shell\org.apache.karaf.shell.console${karaf.version}\org.apache.karaf.shell.console-3.0.8.jar;%KARAF_HOME%\system\org\apache\karaf\shell\org.apache.karaf.shell.table${karaf.version}\org.apache.karaf.shell.table-3.0.8.jar;%KARAF_HOME%\system\org\apache\aries\blueprint\org.apache.aries.blueprint.api${aries.blueprint.api.version}\org.apache.aries.blueprint.api-1.0.1.jar;%KARAF_HOME%\system\org\apache\aries\blueprint\org.apache.aries.blueprint.core${aries.blueprint.core.version}\org.apache.aries.blueprint.core-1.6.1.jar;%KARAF_HOME%\system\org\apache\aries\blueprint\org.apache.aries.blueprint.cm${aries.blueprint.cm.version}\org.apache.aries.blueprint.cm-1.0.8.jar;%KARAF_HOME%\system\org\ops4j\pax\logging\pax-logging-api${pax.logging.version}\pax-logging-api-1.8.4.jar;%KARAF_HOME%\system\org\apache\felix\org.apache.felix.framework${felix.framework.version}\org.apache.felix.framework-4.2.1.jar;%KARAF_HOME%\system\jline\jline${jline.version}\jline-2.13.jar;%CLASSPATH%

:EXECUTE
    if "%SHIFT%" == "true" SET ARGS=%2 %3 %4 %5 %6 %7 %8
    if not "%SHIFT%" == "true" SET ARGS=%1 %2 %3 %4 %5 %6 %7 %8
    rem Execute the Java Virtual Machine
    "%JAVA%" %JAVA_OPTS% %OPTS% -classpath "%CLASSPATH%" -Dkaraf.instances="%KARAF_HOME%\instances" -Dkaraf.home="%KARAF_HOME%" -Dkaraf.base="%KARAF_BASE%" -Dkaraf.etc="%KARAF_ETC%" -Djava.io.tmpdir="%KARAF_DATA%\tmp" -Djava.util.logging.config.file="%KARAF_BASE%\etc\java.util.logging.properties" %KARAF_OPTS% org.apache.karaf.instance.main.Execute %ARGS%

rem # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # #

:END

endlocal
