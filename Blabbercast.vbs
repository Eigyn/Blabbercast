Option Explicit

Dim shell, fso, appDir, batPath, depsPath

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

appDir = fso.GetParentFolderName(WScript.ScriptFullName)
batPath = fso.BuildPath(appDir, "Blabbercast.bat")
depsPath = fso.BuildPath(appDir, "node_modules\express\package.json")

If Not fso.FileExists(batPath) Then
    MsgBox "Could not find Blabbercast.bat next to this launcher.", vbCritical, "Blabbercast"
    WScript.Quit 1
End If

If Not fso.FileExists(depsPath) Then
    MsgBox "Blabbercast dependencies are not installed yet. Run setup.bat first, then launch Blabbercast again.", vbExclamation, "Blabbercast"
    WScript.Quit 1
End If

shell.CurrentDirectory = appDir
shell.Run """" & batPath & """", 0, False
