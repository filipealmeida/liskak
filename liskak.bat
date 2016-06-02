@echo off

set NODEEX=""
set LISKAK="%~dp0\src\liskak.js"
set LISKAKARGS=

for %%i in (
	"C:\Program Files\nodejs\node.exe"
	"C:\Program Files (x86)\nodejs\node.exe" 
	"C:\nodejs\node.exe"
	"D:\Program Files\nodejs\node.exe"
	"D:\Program Files (x86)\nodejs\node.exe" 
	"D:\nodejs\node.exe"
	"E:\Program Files\nodejs\node.exe"
	"E:\Program Files (x86)\nodejs\node.exe" 
	"E:\nodejs\node.exe"
) do (
  	IF EXIST %%i (
  		set NODEEX=%%i
	)
)

echo Using node binary from %NODEEX%
IF %NODEEX%=="" (
	echo "Need nodejs binary in the path; open this script and edit the NODEEX variable"
	goto failure
)

echo Lisk Army Knife is %LISKAK%
echo running %NODEEX% %LISKAK% %*
%NODEEX% %LISKAK% %*

goto end

:failure
echo "Failed to run, check node path"

:end